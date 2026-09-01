use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::commands::GenerateReq;
use crate::google::SpeakerConfig;
use crate::minimax_subtitles::{estimate_word_timings_from_text, TimedWord};
use crate::roleplay::project::{
    RoleplayProject, RoleplayProjectSummary, SaveRoleplayProjectReq, SEG_STATUS_PENDING,
};
use crate::state::AppState;
use crate::voice_profiles::{find_voice_profile, TtsVoiceProfile};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub fn roleplay_list_projects(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<RoleplayProjectSummary>, String> {
    state.db.roleplay_list_projects().map_err(err)
}

#[tauri::command]
pub fn roleplay_create_project(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<RoleplayProject, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("nazwa projektu nie może być pusta".into());
    }
    state.db.roleplay_create_project(name).map_err(err)
}

#[tauri::command]
pub fn roleplay_load_project(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<RoleplayProject, String> {
    state
        .db
        .roleplay_get_project(&id)
        .map_err(err)?
        .ok_or_else(|| "projekt nie istnieje".to_string())
}

#[tauri::command]
pub fn roleplay_save_project(
    state: State<'_, Arc<AppState>>,
    req: SaveRoleplayProjectReq,
) -> Result<RoleplayProject, String> {
    state.db.roleplay_save_project(&req).map_err(err)
}

#[tauri::command]
pub fn roleplay_delete_project(state: State<'_, Arc<AppState>>, id: String) -> Result<(), String> {
    state.db.roleplay_delete_project(&id).map_err(err)
}

#[tauri::command]
pub fn roleplay_rebuild_timeline(
    state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<RoleplayProject, String> {
    let timeline = crate::roleplay::queue::rebuild_roleplay_timeline(state.inner(), &project_id)?;
    state
        .db
        .roleplay_update_timeline(&project_id, &timeline)
        .map_err(err)?;
    state
        .db
        .roleplay_get_project(&project_id)
        .map_err(err)?
        .ok_or_else(|| "projekt nie istnieje".to_string())
}

#[tauri::command]
pub fn roleplay_update_timeline(
    state: State<'_, Arc<AppState>>,
    project_id: String,
    timeline_json: String,
) -> Result<(), String> {
    state
        .db
        .roleplay_update_timeline(&project_id, &timeline_json)
        .map_err(err)
}

#[derive(Debug, Clone, Serialize)]
pub struct RoleplayQueueProgress {
    pub project_id: String,
    pub total: usize,
    pub done: usize,
    pub current_segment_id: Option<String>,
    pub paused: bool,
}

#[tauri::command]
pub fn roleplay_start_queue(
    state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<RoleplayQueueProgress, String> {
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    queue.start_project(state.inner().clone(), project_id).map_err(err)
}

#[tauri::command]
pub fn roleplay_pause_queue(state: State<'_, Arc<AppState>>, project_id: String) -> Result<(), String> {
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    queue.pause(&project_id);
    Ok(())
}

#[tauri::command]
pub fn roleplay_resume_queue(state: State<'_, Arc<AppState>>, project_id: String) -> Result<(), String> {
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    queue
        .resume_project(state.inner().clone(), project_id)
        .map_err(err)
}

#[tauri::command]
pub fn roleplay_cancel_queue(state: State<'_, Arc<AppState>>, project_id: String) -> Result<(), String> {
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    queue.cancel(&project_id);
    Ok(())
}

#[tauri::command]
pub fn roleplay_get_queue_progress(
    state: State<'_, Arc<AppState>>,
    project_id: String,
) -> Result<RoleplayQueueProgress, String> {
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    Ok(queue.progress(&project_id))
}

#[tauri::command]
pub fn roleplay_regenerate_segment(
    state: State<'_, Arc<AppState>>,
    project_id: String,
    segment_id: String,
) -> Result<(), String> {
    let mut project = state
        .db
        .roleplay_get_project(&project_id)
        .map_err(err)?
        .ok_or_else(|| "projekt nie istnieje".to_string())?;
    let seg = project
        .segments
        .iter_mut()
        .find(|s| s.id == segment_id)
        .ok_or_else(|| "segment nie istnieje".to_string())?;
    seg.status = SEG_STATUS_PENDING.to_string();
    seg.generation_id = None;
    seg.error = None;
    state.db.roleplay_update_segment(seg).map_err(err)?;
    let queue = state
        .roleplay_queue
        .get()
        .ok_or_else(|| "kolejka roleplay nie jest gotowa".to_string())?;
    queue
        .enqueue_segment(state.inner().clone(), project_id, segment_id)
        .map_err(err)
}

#[tauri::command]
pub async fn roleplay_import_audio(
    state: State<'_, Arc<AppState>>,
    project_id: String,
    source_path: String,
) -> Result<String, String> {
    let paths = state.paths.read().map_err(err)?;
    let dir = paths.roleplay_projects.join(&project_id);
    std::fs::create_dir_all(&dir).map_err(err)?;
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav");
    let dest = dir.join(format!("import_{}.{}", uuid::Uuid::new_v4(), ext));
    std::fs::copy(&source_path, &dest).map_err(err)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn roleplay_write_mix_wav(
    state: State<'_, Arc<AppState>>,
    project_id: String,
    wav_base64: String,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(wav_base64.trim())
        .map_err(|e| format!("base64: {e}"))?;
    let paths = state.paths.read().map_err(err)?;
    let dir = paths.roleplay_projects.join(&project_id);
    std::fs::create_dir_all(&dir).map_err(err)?;
    let path = dir.join(format!("mix_{}.wav", uuid::Uuid::new_v4()));
    std::fs::write(&path, bytes).map_err(err)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn roleplay_export_mix(
    _state: State<'_, Arc<AppState>>,
    wav_path: String,
    dest_path: String,
    format: String,
) -> Result<String, String> {
    use crate::audio::{convert_audio_file, AudioFormat};
    let fmt = AudioFormat::from_str(&format).ok_or_else(|| "nieznany format".to_string())?;
    let src = std::path::Path::new(&wav_path);
    if !src.exists() {
        return Err("plik WAV nie istnieje".into());
    }
    convert_audio_file(src, std::path::Path::new(&dest_path), fmt).map_err(err)?;
    Ok(dest_path)
}

/// Multi-voice roleplay mix → MP4 (still cover + karaoke timed from timeline clips).
#[tauri::command]
pub async fn roleplay_export_mp4(
    state: State<'_, Arc<AppState>>,
    app: AppHandle,
    project_id: String,
    wav_path: String,
    dest_path: String,
    template_id: Option<String>,
) -> Result<String, String> {
    use crate::video_export::{
        apply_template_to_opts, export_still_video_with_audio, Mp4ExportProgress,
        ShareVideoExportOptions,
    };
    use crate::video_template::{default_template_id, load_template_by_id};

    let export_id = format!("roleplay-{project_id}");
    let _ = app.emit(
        "mp4-export-progress",
        Mp4ExportProgress {
            id: export_id.clone(),
            phase: "start".to_string(),
            percent: 0.0,
            message: "Przygotowuję multi-głosowe MP4…".to_string(),
            eta_ms: None,
        },
    );

    let audio = PathBuf::from(&wav_path);
    if !audio.is_file() {
        return Err("plik miksu WAV nie istnieje".into());
    }
    let dest = PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }

    let project = state
        .db
        .roleplay_get_project(&project_id)
        .map_err(err)?
        .ok_or_else(|| "projekt nie istnieje".to_string())?;

    let (root, temp, roleplay_projects) = {
        let paths = state.paths.read().map_err(err)?;
        (
            paths.root.clone(),
            paths.temp.clone(),
            paths.roleplay_projects.clone(),
        )
    };
    let tpl_id = match template_id.filter(|s| !s.trim().is_empty()) {
        Some(id) => id,
        None => {
            let settings = state.settings.read().map_err(err)?;
            default_template_id(&settings)
        }
    };
    let template = load_template_by_id(&root, &tpl_id).map_err(err)?;

    let cover = ensure_roleplay_cover(&temp.join("clipboard_cache"))?;
    let karaoke_words = build_roleplay_karaoke_words(&project);
    let subtitle_path = roleplay_projects
        .join(&project_id)
        .join(format!("karaoke_{}.json", uuid::Uuid::new_v4()));
    if let Some(parent) = subtitle_path.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    write_karaoke_words_json(&subtitle_path, &karaoke_words).map_err(err)?;

    let fallback_text: String = project
        .segments
        .iter()
        .map(|s| s.text.trim())
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    let app_progress = app.clone();
    let progress_id = export_id.clone();
    let progress: Arc<dyn Fn(Mp4ExportProgress) + Send + Sync> = Arc::new(move |p| {
        let mut payload = p;
        payload.id = progress_id.clone();
        let _ = app_progress.emit("mp4-export-progress", &payload);
    });

    let voice_count = {
        let mut ids = std::collections::HashSet::new();
        for s in &project.segments {
            ids.insert(s.voice_profile_id.as_str());
        }
        ids.len()
    };
    let footer = format!(
        "{} · {} głosy · Roleplay · TTS Hub",
        project.name,
        voice_count.max(1)
    );

    let mut opts = ShareVideoExportOptions {
        title_lines: vec![project.name.clone()],
        subtitle_json: Some(subtitle_path.clone()),
        fallback_karaoke_text: Some(fallback_text),
        audio_path: audio.clone(),
        footer_line: Some(footer),
        watermark_text: "TTS Hub".to_string(),
        watermark_logo: Some(cover.clone()),
        export_id: Some(export_id.clone()),
        progress: Some(progress),
        karaoke_enabled: true,
        ..Default::default()
    };
    apply_template_to_opts(&mut opts, &template, None);

    let audio_c = audio.clone();
    let cover_c = cover.clone();
    let dest_c = dest.clone();
    tauri::async_runtime::spawn_blocking(move || {
        export_still_video_with_audio(&audio_c, &cover_c, &dest_c, &opts).map_err(err)
    })
    .await
    .map_err(|e| format!("{e}"))??;

    let _ = std::fs::remove_file(&subtitle_path);

    let _ = app.emit(
        "mp4-export-progress",
        Mp4ExportProgress {
            id: export_id,
            phase: "done".to_string(),
            percent: 1.0,
            message: "MP4 gotowe".to_string(),
            eta_ms: Some(0),
        },
    );

    Ok(dest_path)
}

fn ensure_roleplay_cover(cache_dir: &Path) -> Result<PathBuf, String> {
    std::fs::create_dir_all(cache_dir).map_err(err)?;
    let path = cache_dir.join("_default_cover.png");
    if !path.is_file() {
        std::fs::write(&path, include_bytes!("../../icons/128x128.png")).map_err(err)?;
    }
    Ok(path)
}

fn write_karaoke_words_json(path: &Path, words: &[TimedWord]) -> Result<(), String> {
    let items: Vec<serde_json::Value> = words
        .iter()
        .map(|w| {
            serde_json::json!({
                "text": w.text,
                "start_ms": w.start_ms,
                "end_ms": w.end_ms,
            })
        })
        .collect();
    let payload = serde_json::json!({ "words": items });
    std::fs::write(path, serde_json::to_vec_pretty(&payload).map_err(err)?).map_err(err)
}

fn build_roleplay_karaoke_words(project: &RoleplayProject) -> Vec<TimedWord> {
    #[derive(serde::Deserialize, Default)]
    struct Timeline {
        #[serde(default)]
        clips: Vec<TimelineClip>,
        #[serde(default)]
        tracks: Vec<TimelineTrack>,
    }
    #[derive(serde::Deserialize)]
    struct TimelineClip {
        #[serde(default)]
        segment_id: Option<String>,
        #[serde(alias = "trackId")]
        track_id: String,
        #[serde(alias = "startSec", default)]
        start_sec: f64,
        #[serde(alias = "durationSec", default)]
        duration_sec: f64,
    }
    #[derive(serde::Deserialize)]
    struct TimelineTrack {
        id: String,
        #[serde(default)]
        name: String,
        #[serde(alias = "voiceProfileId", default)]
        voice_profile_id: Option<String>,
    }

    let timeline: Timeline = serde_json::from_str(&project.timeline_json).unwrap_or_default();
    let seg_by_id: std::collections::HashMap<&str, &crate::roleplay::project::RoleplaySegment> =
        project.segments.iter().map(|s| (s.id.as_str(), s)).collect();
    let track_name: std::collections::HashMap<&str, String> = timeline
        .tracks
        .iter()
        .map(|t| {
            let label = if !t.name.trim().is_empty() {
                t.name.clone()
            } else {
                t.voice_profile_id.clone().unwrap_or_else(|| t.id.clone())
            };
            (t.id.as_str(), label)
        })
        .collect();

    let mut clips: Vec<&TimelineClip> = timeline.clips.iter().filter(|c| c.segment_id.is_some()).collect();
    clips.sort_by(|a, b| {
        a.start_sec
            .partial_cmp(&b.start_sec)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut out = Vec::new();
    for clip in clips {
        let Some(seg_id) = clip.segment_id.as_deref() else {
            continue;
        };
        let Some(seg) = seg_by_id.get(seg_id) else {
            continue;
        };
        let text = seg.text.trim();
        if text.is_empty() {
            continue;
        }
        let start_ms = (clip.start_sec.max(0.0) * 1000.0).round() as u64;
        let duration_ms = (clip.duration_sec.max(0.1) * 1000.0).round() as u64;
        let speaker = track_name
            .get(clip.track_id.as_str())
            .cloned()
            .unwrap_or_else(|| seg.voice_profile_id.clone());

        // Speaker tag as a short lead-in word, then dialogue timed to clip length.
        let tag_ms = 280u64.min(duration_ms / 6).max(80);
        out.push(TimedWord {
            text: format!("{speaker}:"),
            start_ms,
            end_ms: start_ms + tag_ms,
        });
        let body_start = start_ms + tag_ms;
        let body_dur = duration_ms.saturating_sub(tag_ms).max(80);
        for mut w in estimate_word_timings_from_text(text, body_dur) {
            w.start_ms = w.start_ms.saturating_add(body_start);
            w.end_ms = w.end_ms.saturating_add(body_start);
            out.push(w);
        }
    }
    out
}

pub fn build_generate_req_from_profile(
    profile: &TtsVoiceProfile,
    text: &str,
    format: &str,
) -> GenerateReq {
    GenerateReq {
        text: text.to_string(),
        model: profile.model.clone(),
        voice: profile.voice.clone(),
        style: profile.style.clone(),
        format: format.to_string(),
        multi_speaker: if profile.multi_speaker && !profile.speakers.is_empty() {
            Some(
                profile
                    .speakers
                    .iter()
                    .map(|s| SpeakerConfig {
                        speaker: s.speaker.clone(),
                        voice: s.voice.clone(),
                    })
                    .collect(),
            )
        } else {
            None
        },
        provider: Some(profile.provider.clone()),
        profile_id: profile.profile_id.clone(),
        language: profile.language.clone(),
        engine: profile.engine.clone(),
        personality: None,
        autoplay: false,
        source: Some("roleplay".to_string()),
        conversation_id: None,
        summary_text: None,
        filtered_text: None,
        filter_config: None,
        minimax_speed: profile.minimax_speed,
        minimax_vol: profile.minimax_vol,
        minimax_pitch: profile.minimax_pitch,
        minimax_options: profile.minimax_options.clone(),
        original_prompt: None,
        chat_session_id: None,
        chat_role: None,
        // Roleplay/voice-profile TTS comes from the desktop UI; no messenger
        // origin. External callers (Telegram bot etc.) construct GenerateReq
        // directly in commands.rs and can populate this.
        origin: None,
        // === voice-profile attribution (2026-06-09) ===
        // Each roleplay segment is bound to a saved voice profile by id.
        // We snapshot it onto the request so the resulting Generation row
        // (and any chat bubble, when the segment is replayed through the
        // chat window) carries the badge back to the same profile.
        voice_profile_id: Some(profile.id.clone()),
        context_label: None,
    }
}

pub fn resolve_voice_profile(
    state: &AppState,
    voice_profile_id: &str,
) -> Result<TtsVoiceProfile, String> {
    let settings = state.settings.read().map_err(err)?;
    find_voice_profile(&settings.voice_profiles, Some(voice_profile_id))
        .cloned()
        .ok_or_else(|| format!("nie znaleziono profilu głosu: {voice_profile_id}"))
}

