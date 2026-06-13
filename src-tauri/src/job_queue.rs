use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use anyhow::Result;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::{broadcast, mpsc, Semaphore};

use crate::app_settings::{SaveMode, MAX_CONCURRENT_JOBS_CAP};
use crate::audio::{write_audio, write_downloaded_audio, AudioFormat};
use crate::commands::{derive_title, GenerateReq};
use crate::db::{Generation, GenerationUsage, STATUS_CANCELLED, STATUS_DONE, STATUS_FAILED};
use crate::google::TtsRequest;
use crate::minimax::{
    model_from_id, resolve_minimax_options, MinimaxClonedVoice, MinimaxClient,
    MinimaxGenerateParams, DEFAULT_MINIMAX_LANGUAGE,
};
use crate::state::AppState;
use crate::voicebox::engine_from_model;

#[derive(Clone, Serialize)]
pub struct JobPhaseEvent {
    pub job_id: String,
    pub phase: &'static str,
    pub elapsed_ms: u128,
    pub chars: usize,
}

#[derive(Clone, Serialize)]
pub struct JobUpdateEvent {
    pub job_id: String,
    pub status: String,
    pub error: Option<String>,
}

pub struct JobQueue {
    tx: mpsc::UnboundedSender<String>,
    semaphore: Arc<Semaphore>,
    cancelled: Mutex<HashSet<String>>,
    updates: broadcast::Sender<JobUpdateEvent>,
    current_permits: Mutex<u32>,
}

impl JobQueue {
    pub fn start(state: Arc<AppState>, app: AppHandle, max_concurrent: u32) -> Arc<Self> {
        let max = max_concurrent.max(1).min(MAX_CONCURRENT_JOBS_CAP) as usize;
        let semaphore = Arc::new(Semaphore::new(max));
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        let (updates, _) = broadcast::channel(64);
        let queue = Arc::new(Self {
            tx,
            semaphore: semaphore.clone(),
            cancelled: Mutex::new(HashSet::new()),
            updates,
            current_permits: Mutex::new(max as u32),
        });

        let queue_for_loop = queue.clone();
        let state_for_loop = state.clone();
        let app_for_loop = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(id) = rx.recv().await {
                let permit = match queue_for_loop.semaphore.clone().acquire_owned().await {
                    Ok(p) => p,
                    Err(_) => break,
                };
                let queue = queue_for_loop.clone();
                let state = state_for_loop.clone();
                let app = app_for_loop.clone();
                tauri::async_runtime::spawn(async move {
                    let _permit = permit;
                    queue.run_job(state, app, &id).await;
                });
            }
        });

        queue
    }

    pub fn subscribe(&self) -> broadcast::Receiver<JobUpdateEvent> {
        self.updates.subscribe()
    }

    /// Enqueue a previously-persisted row id (status must already be 'queued' in DB).
    pub fn enqueue(&self, id: String) -> Result<()> {
        self.tx
            .send(id)
            .map_err(|e| anyhow::anyhow!("queue closed: {e}"))
    }

    pub fn request_cancel(&self, id: &str) {
        self.cancelled.lock().unwrap().insert(id.to_string());
    }

    fn take_cancel(&self, id: &str) -> bool {
        self.cancelled.lock().unwrap().remove(id)
    }

    /// Adjust semaphore permits to reflect new concurrency setting at runtime.
    pub fn set_max_concurrent(&self, max_concurrent: u32) {
        let new = max_concurrent.max(1).min(MAX_CONCURRENT_JOBS_CAP);
        let mut cur = self.current_permits.lock().unwrap();
        if new > *cur {
            self.semaphore.add_permits((new - *cur) as usize);
        } else if new < *cur {
            // Acquire-and-forget the difference so future workers see fewer permits.
            let need = (*cur - new) as u32;
            let sem = self.semaphore.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(permit) = sem.acquire_many_owned(need).await {
                    permit.forget();
                }
            });
        }
        *cur = new;
    }

    async fn run_job(self: Arc<Self>, state: Arc<AppState>, app: AppHandle, id: &str) {
        if self.take_cancel(id) {
            self.handle_cancel(&state, &app, id);
            return;
        }
        let row = match state.db.get(id) {
            Ok(Some(g)) => g,
            _ => return,
        };
        let req_json = match row.request_json.clone() {
            Some(s) => s,
            None => {
                self.finalize_failed(&state, &app, id, "missing request_json");
                return;
            }
        };
        let req: GenerateReq = match serde_json::from_str(&req_json) {
            Ok(r) => r,
            Err(e) => {
                self.finalize_failed(&state, &app, id, &format!("bad request_json: {e}"));
                return;
            }
        };
        if let Err(e) = state.db.mark_running(id) {
            self.finalize_failed(&state, &app, id, &format!("db: {e}"));
            return;
        }
        let _ = self.broadcast_status(id, "running", None);
        let _ = app.emit(
            "job:running",
            JobUpdateEvent {
                job_id: id.to_string(),
                status: "running".to_string(),
                error: None,
            },
        );

        if let Err(e) = self.execute(&state, &app, id, &row, req).await {
            self.finalize_failed(&state, &app, id, &e);
        }
    }

    async fn execute(
        &self,
        state: &Arc<AppState>,
        app: &AppHandle,
        id: &str,
        row: &Generation,
        req: GenerateReq,
    ) -> Result<(), String> {
        let started = Instant::now();
        let chars = req.text.chars().count();

        self.emit_phase(app, id, started, "preparing", chars);
        if req.text.trim().is_empty() {
            return Err("text is empty".into());
        }
        let fmt = AudioFormat::from_str(&req.format).ok_or_else(|| "unknown format".to_string())?;
        if self.take_cancel(id) {
            self.handle_cancel(state, app, id);
            return Ok(());
        }

        let synth_text = req
            .summary_text
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(String::from)
            .or_else(|| {
                req.filtered_text
                    .as_ref()
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .map(String::from)
            })
            .unwrap_or_else(|| req.text.clone());
        let synth_char_count = synth_text.chars().count() as i64;

        self.emit_phase(app, id, started, "requesting", chars);
        let provider = req
            .provider
            .as_deref()
            .unwrap_or("google")
            .trim()
            .to_ascii_lowercase();

        if provider == "voicebox" {
            let profile_id = req
                .profile_id
                .as_deref()
                .unwrap_or(&req.voice)
                .trim()
                .to_string();
            if profile_id.is_empty() {
                return Err("Voice Box profile is required".into());
            }
            let language = req
                .language
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("pl");
            let engine = req
                .engine
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .or_else(|| engine_from_model(&req.model));
            let instruct = req
                .style
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());

            let audio = state
                .voicebox
                .generate_audio(crate::voicebox::VoiceBoxGenerateParams {
                    profile_id: &profile_id,
                    text: &synth_text,
                    language,
                    engine,
                    instruct,
                    personality: req.personality,
                })
                .await
                .map_err(|e| format!("{e}"))?;

            if self.take_cancel(id) {
                self.handle_cancel(state, app, id);
                return Ok(());
            }

            self.emit_phase(app, id, started, "writing", chars);
            let temp_dir: PathBuf = {
                let paths = state.paths.read().map_err(|e| format!("{e}"))?;
                paths.temp.clone()
            };
            let source_fmt = AudioFormat::from_str(&audio.format).unwrap_or(AudioFormat::Wav);
            let written = write_downloaded_audio(&audio.bytes, source_fmt, &temp_dir, id, fmt)
                .map_err(|e| format!("{e}"))?;

            let title_src = req.summary_text.as_deref().unwrap_or(&req.text);
            let title = derive_title(title_src);
            let file_path = written.path.to_string_lossy().to_string();
            let usage = GenerationUsage {
                provider: Some("voicebox".to_string()),
                input_chars: Some(synth_char_count),
                prompt_tokens: None,
                output_tokens: None,
                total_tokens: None,
            };
            state
                .db
                .finalize_done(
                    id,
                    &file_path,
                    written.format.ext(),
                    audio.duration_ms,
                    Some(&title),
                    Some(&usage),
                )
                .map_err(|e| format!("{e}"))?;
        } else if provider == "minimax" {
            let voice_id = req.voice.trim().to_string();
            if voice_id.is_empty() {
                return Err("Minimax voice_id is required".into());
            }
            {
                let presets = {
                    let settings = state.settings.read().map_err(|e| format!("{e}"))?;
                    MinimaxClient::effective_preset_voices(
                        &settings.minimax_synced_voices,
                        &settings.effective_minimax_enabled_languages(),
                    )
                };
                let exists = state
                    .minimax
                    .voice_exists_on_account(&voice_id, &presets)
                    .await
                    .map_err(|e| format!("{e}"))?;
                if !exists {
                    return Err(format!(
                        "Głos „{voice_id}” nie istnieje w MiniMax. \
                         Kliknij „Synchronizuj głosy z API” lub sklonuj go ponownie („Stwórz głos”)."
                    ));
                }
            }
            let model = model_from_id(&req.model).to_string();
            let (mut minimax_options, preset_vol) = {
                let settings = state.settings.read().map_err(|e| format!("{e}"))?;
                let opts = resolve_minimax_options(
                    req.minimax_options.clone(),
                    Some(&settings.minimax_provider_settings.default_synthesis),
                    req.minimax_speed,
                    req.minimax_vol,
                    req.minimax_pitch,
                    req.language.as_deref().or(Some(DEFAULT_MINIMAX_LANGUAGE)),
                );
                let pv = opts.voice.vol;
                (opts, pv)
            };
            minimax_options.voice.vol = {
                let settings = state.settings.read().map_err(|e| format!("{e}"))?;
                MinimaxClonedVoice::effective_minimax_vol(
                    &settings.minimax_cloned_voices,
                    &voice_id,
                    preset_vol,
                )
            };
            let audio = state
                .minimax
                .generate_audio(MinimaxGenerateParams {
                    model: &model,
                    text: &synth_text,
                    voice_id: &voice_id,
                    hub_format: &req.format,
                    options: &minimax_options,
                })
                .await
                .map_err(|e| format!("{e}"))?;

            if self.take_cancel(id) {
                self.handle_cancel(state, app, id);
                return Ok(());
            }

            self.emit_phase(app, id, started, "writing", chars);
            let temp_dir: PathBuf = {
                let paths = state.paths.read().map_err(|e| format!("{e}"))?;
                paths.temp.clone()
            };
            let source_fmt = AudioFormat::from_str(&audio.format).unwrap_or(AudioFormat::Mp3);
            let written = write_downloaded_audio(&audio.bytes, source_fmt, &temp_dir, id, fmt)
                .map_err(|e| format!("{e}"))?;

            if let Some(sub) = &audio.subtitle_bytes {
                let sub_path = temp_dir.join(format!("{id}_subtitles.json"));
                let _ = std::fs::write(&sub_path, sub);
            }

            let title_src = req.summary_text.as_deref().unwrap_or(&req.text);
            let title = derive_title(title_src);
            let file_path = written.path.to_string_lossy().to_string();
            let usage = GenerationUsage {
                provider: Some("minimax".to_string()),
                input_chars: Some(synth_char_count),
                prompt_tokens: None,
                output_tokens: None,
                total_tokens: None,
            };
            state
                .db
                .finalize_done(
                    id,
                    &file_path,
                    written.format.ext(),
                    None,
                    Some(&title),
                    Some(&usage),
                )
                .map_err(|e| format!("{e}"))?;
        } else {
            let tts_req = TtsRequest {
                model: req.model.clone(),
                text: synth_text,
                voice: req.voice.clone(),
                style: req.style.clone(),
                multi_speaker: req.multi_speaker.clone(),
            };

            let tts_result = state
                .tts
                .synthesize(&tts_req)
                .await
                .map_err(|e| format!("{e}"))?;

            if self.take_cancel(id) {
                self.handle_cancel(state, app, id);
                return Ok(());
            }

            self.emit_phase(app, id, started, "decoding", chars);
            let stem = id.to_string();
            self.emit_phase(app, id, started, "writing", chars);
            let temp_dir: PathBuf = {
                let paths = state.paths.read().map_err(|e| format!("{e}"))?;
                paths.temp.clone()
            };
            let written =
                write_audio(&tts_result, &temp_dir, &stem, fmt).map_err(|e| format!("{e}"))?;

            let title_src = req.summary_text.as_deref().unwrap_or(&req.text);
            let title = derive_title(title_src);
            let file_path = written.path.to_string_lossy().to_string();
            let usage = GenerationUsage {
                provider: Some("google".to_string()),
                input_chars: Some(synth_char_count),
                prompt_tokens: tts_result
                    .token_usage
                    .as_ref()
                    .and_then(|u| u.prompt_tokens),
                output_tokens: tts_result
                    .token_usage
                    .as_ref()
                    .and_then(|u| u.output_tokens),
                total_tokens: tts_result.token_usage.as_ref().and_then(|u| u.total_tokens),
            };
            state
                .db
                .finalize_done(
                    id,
                    &file_path,
                    fmt.ext(),
                    Some(written.duration_ms as i64),
                    Some(&title),
                    Some(&usage),
                )
                .map_err(|e| format!("{e}"))?;
        }

        self.emit_phase(app, id, started, "done", chars);
        let _ = self.broadcast_status(id, STATUS_DONE, None);

        let row_after = state
            .db
            .get(id)
            .ok()
            .flatten()
            .unwrap_or_else(|| row.clone());
        let archive_fmt = {
            let s = state.settings.read().map_err(|e| format!("{e}"))?;
            AudioFormat::from_str(&s.save_format).unwrap_or(AudioFormat::Wav)
        };
        let auto_archive = state
            .settings
            .read()
            .map(|s| s.save_mode == SaveMode::Auto)
            .unwrap_or(false);
        let final_gen = if row_after.folder_id.is_some() {
            match crate::commands::do_archive(
                state,
                id.to_string(),
                archive_fmt,
                row_after.folder_id.clone(),
            ) {
                Ok(g) => g,
                Err(_) => row_after.clone(),
            }
        } else if auto_archive {
            match crate::commands::do_archive(state, id.to_string(), archive_fmt, None) {
                Ok(g) => g,
                Err(_) => row_after.clone(),
            }
        } else {
            row_after
        };

        if req.autoplay {
            let _ = app.emit("generation:ready", &final_gen);
        }
        let _ = app.emit("job:done", &final_gen);

        if !auto_archive {
            let _ = state.apply_temp_retention();
        }

        Ok(())
    }

    fn handle_cancel(&self, state: &Arc<AppState>, app: &AppHandle, id: &str) {
        if let Ok(Some(g)) = state.db.get(id) {
            if !g.file_path.is_empty() {
                let _ = std::fs::remove_file(&g.file_path);
            }
        }
        let _ = state.db.update_status(id, STATUS_CANCELLED, None);
        let _ = self.broadcast_status(id, STATUS_CANCELLED, None);
        let _ = app.emit(
            "job:cancelled",
            JobUpdateEvent {
                job_id: id.to_string(),
                status: STATUS_CANCELLED.to_string(),
                error: None,
            },
        );
    }

    fn finalize_failed(&self, state: &Arc<AppState>, app: &AppHandle, id: &str, error: &str) {
        let _ = state.db.update_status(id, STATUS_FAILED, Some(error));
        let _ = self.broadcast_status(id, STATUS_FAILED, Some(error.to_string()));
        let _ = app.emit(
            "job:error",
            JobUpdateEvent {
                job_id: id.to_string(),
                status: STATUS_FAILED.to_string(),
                error: Some(error.to_string()),
            },
        );
    }

    fn broadcast_status(
        &self,
        id: &str,
        status: &str,
        error: Option<String>,
    ) -> Result<(), broadcast::error::SendError<JobUpdateEvent>> {
        self.updates
            .send(JobUpdateEvent {
                job_id: id.to_string(),
                status: status.to_string(),
                error,
            })
            .map(|_| ())
    }

    fn emit_phase(
        &self,
        app: &AppHandle,
        id: &str,
        started: Instant,
        phase: &'static str,
        chars: usize,
    ) {
        let _ = app.emit(
            "job:phase",
            JobPhaseEvent {
                job_id: id.to_string(),
                phase,
                elapsed_ms: started.elapsed().as_millis(),
                chars,
            },
        );
    }
}
