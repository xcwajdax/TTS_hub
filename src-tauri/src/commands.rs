use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

use crate::app_settings::{AppSettings, CursorIntegration};
use crate::cursor_integration::{self, InstallReport, IntegrationStatus, UninstallReport};
use crate::audio::{convert_audio_file, AudioFormat};
use crate::db::{Generation, STATUS_CANCELLED, STATUS_DONE, STATUS_INTERRUPTED, STATUS_QUEUED};
use crate::google::{SpeakerConfig, TtsModelInfo, VOICES};
use crate::paths::AppPaths;
use crate::state::AppState;
use crate::voice_samples::{self, VoiceSampleInfo};

type AppArc = Arc<AppState>;

fn err(e: impl std::fmt::Display) -> String {
    format!("{e}")
}

fn read_paths(state: &AppArc) -> Result<std::sync::RwLockReadGuard<'_, AppPaths>, String> {
    state.paths.read().map_err(|e| err(e))
}

/// First sentence or line of TTS text, capped for history labels.
pub fn derive_title(text: &str) -> String {
    let text = text.trim();
    if text.is_empty() {
        return String::from("Bez tytułu");
    }
    let first_line = text.lines().next().unwrap_or(text).trim();
    let end = first_line
        .find(|c| c == '.' || c == '!' || c == '?')
        .map(|i| i + 1)
        .unwrap_or(first_line.len());
    let title = first_line[..end].trim();
    let title = if title.is_empty() { first_line } else { title };
    let chars: Vec<char> = title.chars().collect();
    if chars.len() > 80 {
        chars.into_iter().take(80).collect::<String>() + "…"
    } else {
        title.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateReq {
    pub text: String,
    pub model: String,
    pub voice: String,
    pub style: Option<String>,
    pub format: String,
    pub multi_speaker: Option<Vec<SpeakerConfig>>,
    #[serde(default)]
    pub autoplay: bool,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub summary_text: Option<String>,
}

/// Persist a queued row + push to the worker pool. Returns the queued Generation row.
/// Used by both the Tauri command and the HTTP /generate endpoint.
pub fn enqueue_request(state: &AppArc, req: GenerateReq) -> Result<Generation, String> {
    if req.text.trim().is_empty() {
        return Err("text is empty".into());
    }
    AudioFormat::from_str(&req.format).ok_or_else(|| "unknown format".to_string())?;

    let id = uuid::Uuid::new_v4().to_string();
    let now_ms = chrono::Utc::now().timestamp_millis();
    let title_src = req.summary_text.as_deref().unwrap_or(&req.text);
    let title = derive_title(title_src);
    let source = req
        .source
        .as_ref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "manual".to_string());
    let request_json = serde_json::to_string(&req).map_err(err)?;

    let gen = Generation {
        id: id.clone(),
        created_at: now_ms,
        text: req.text.clone(),
        title: Some(title),
        model: req.model.clone(),
        voice: req.voice.clone(),
        style: req.style.clone(),
        format: req.format.to_lowercase(),
        duration_ms: None,
        file_path: String::new(),
        is_archived: false,
        session_id: state.session_id.clone(),
        source,
        conversation_id: req.conversation_id.clone(),
        summary_text: req.summary_text.clone(),
        status: STATUS_QUEUED.to_string(),
        error: None,
        attempts: 0,
        updated_at: now_ms,
        request_json: Some(request_json),
    };
    state.db.insert(&gen).map_err(err)?;

    let queue = state
        .job_queue()
        .ok_or_else(|| "job queue not initialized".to_string())?;
    queue.enqueue(id.clone()).map_err(err)?;
    Ok(gen)
}

#[tauri::command]
pub async fn generate(
    req: GenerateReq,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    let state = state.inner().clone();
    enqueue_request(&state, req)
}

#[tauri::command]
pub fn list_history(scope: String, state: State<'_, AppArc>) -> Result<Vec<Generation>, String> {
    match scope.as_str() {
        "session" => state.db.list_session(&state.session_id).map_err(err),
        "archive" => state.db.list_archive().map_err(err),
        _ => Err("invalid scope".into()),
    }
}

/// scope: "active" (queued+running) | "interrupted" | "failed" | "all".
#[tauri::command]
pub fn list_jobs(scope: String, state: State<'_, AppArc>) -> Result<Vec<Generation>, String> {
    let statuses: &[&str] = match scope.as_str() {
        "active" => &["queued", "running"],
        "interrupted" => &["interrupted"],
        "failed" => &["failed"],
        "all" => &[
            "queued",
            "running",
            "interrupted",
            "failed",
            "cancelled",
        ],
        _ => return Err("invalid scope".into()),
    };
    state.db.list_by_statuses(statuses).map_err(err)
}

#[tauri::command]
pub fn cancel_job(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    let row = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    match row.status.as_str() {
        "queued" => {
            // Worker will pick it up and immediately mark cancelled.
            if let Some(q) = state.job_queue() {
                q.request_cancel(&id);
            }
            state.db.update_status(&id, STATUS_CANCELLED, None).map_err(err)?;
            Ok(())
        }
        "running" => {
            if let Some(q) = state.job_queue() {
                q.request_cancel(&id);
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn resume_job(id: String, state: State<'_, AppArc>) -> Result<Generation, String> {
    let row = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if row.request_json.is_none() {
        return Err("cannot resume: missing original request".into());
    }
    if !matches!(row.status.as_str(), "interrupted" | "failed" | "cancelled") {
        return Err(format!("cannot resume from status '{}'", row.status));
    }
    state.db.mark_queued(&id).map_err(err)?;
    let queue = state
        .job_queue()
        .ok_or_else(|| "job queue not initialized".to_string())?;
    queue.enqueue(id.clone()).map_err(err)?;
    state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".into())
}

#[tauri::command]
pub fn discard_job(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    if let Some(g) = state.db.get(&id).map_err(err)? {
        if !g.file_path.is_empty() && g.status != STATUS_DONE {
            let _ = std::fs::remove_file(&g.file_path);
        }
    }
    state.db.delete(&id).map_err(err)
}

#[tauri::command]
pub fn resume_all_interrupted(state: State<'_, AppArc>) -> Result<Vec<Generation>, String> {
    let rows = state.db.list_by_statuses(&[STATUS_INTERRUPTED]).map_err(err)?;
    let queue = state
        .job_queue()
        .ok_or_else(|| "job queue not initialized".to_string())?;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        if row.request_json.is_none() {
            continue;
        }
        state.db.mark_queued(&row.id).map_err(err)?;
        queue.enqueue(row.id.clone()).map_err(err)?;
        if let Ok(Some(g)) = state.db.get(&row.id) {
            out.push(g);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn discard_all_interrupted(state: State<'_, AppArc>) -> Result<usize, String> {
    let rows = state.db.list_by_statuses(&[STATUS_INTERRUPTED]).map_err(err)?;
    let n = rows.len();
    for row in rows {
        if !row.file_path.is_empty() {
            let _ = std::fs::remove_file(&row.file_path);
        }
        let _ = state.db.delete(&row.id);
    }
    Ok(n)
}

#[tauri::command]
pub fn update_generation_title(
    id: String,
    title: String,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    let mut g = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    let trimmed = title.trim();
    let stored = if trimmed.is_empty() {
        derive_title(&g.text)
    } else {
        trimmed.to_string()
    };
    state.db.update_title(&id, &stored).map_err(err)?;
    g.title = Some(stored);
    Ok(g)
}

#[tauri::command]
pub fn archive_generation(id: String, format: String, state: State<'_, AppArc>) -> Result<Generation, String> {
    let target = AudioFormat::from_str(&format).ok_or_else(|| "unknown format".to_string())?;
    do_archive(&state, &id, target)
}

pub fn do_archive(state: &AppArc, id: &str, target: AudioFormat) -> Result<Generation, String> {
    let mut g = state
        .db
        .get(id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if g.is_archived {
        return Ok(g);
    }
    let src = PathBuf::from(&g.file_path);
    if !src.is_file() {
        return Err("source audio file missing".into());
    }
    let paths = read_paths(state)?;
    let dst = paths.archive.join(format!("{id}.{}", target.ext()));
    std::fs::create_dir_all(&paths.archive).map_err(err)?;
    drop(paths);

    let current = AudioFormat::from_str(&g.format).unwrap_or(AudioFormat::Wav);
    if current == target {
        std::fs::copy(&src, &dst).map_err(err)?;
    } else {
        convert_audio_file(&src, &dst, target).map_err(err)?;
    }
    let _ = std::fs::remove_file(&src);

    let dst_str = dst.to_string_lossy().to_string();
    let format_str = target.ext().to_string();
    state
        .db
        .update_archived(id, true, &dst_str, &format_str)
        .map_err(err)?;
    g.is_archived = true;
    g.file_path = dst_str;
    g.format = format_str;
    Ok(g)
}

#[tauri::command]
pub fn delete_generation(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    if let Some(g) = state.db.get(&id).map_err(err)? {
        let _ = std::fs::remove_file(&g.file_path);
    }
    state.db.delete(&id).map_err(err)
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    reveal_path(&path)
}

#[tauri::command]
pub fn open_archive_folder(state: State<'_, AppArc>) -> Result<(), String> {
    let paths = read_paths(&state)?;
    open_folder(&paths.archive.to_string_lossy())
}

#[derive(Debug, Clone, Serialize)]
pub struct AppSettingsView {
    #[serde(flatten)]
    pub settings: AppSettings,
    pub effective_temp_path: String,
    pub effective_archive_path: String,
    pub env_api_key_available: bool,
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppArc>) -> Result<AppSettingsView, String> {
    let settings = state.settings.read().map_err(err)?.clone();
    let paths = read_paths(&state)?;
    Ok(AppSettingsView {
        settings,
        effective_temp_path: paths.temp.to_string_lossy().to_string(),
        effective_archive_path: paths.archive.to_string_lossy().to_string(),
        env_api_key_available: !state.env_google_key.trim().is_empty(),
    })
}

#[tauri::command]
pub fn set_app_settings(settings: AppSettings, state: State<'_, AppArc>) -> Result<AppSettingsView, String> {
    state.apply_and_save_settings(settings).map_err(err)?;
    get_app_settings(state)
}

async fn pick_folder_dialog(app: &AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    app.dialog().file().pick_folder(move |f| {
        let _ = tx.send(f.map(|p| p.to_string()));
    });
    rx.await.map_err(err)
}

#[tauri::command]
pub async fn pick_temp_folder(state: State<'_, AppArc>, app: AppHandle) -> Result<Option<String>, String> {
    let picked = pick_folder_dialog(&app).await?;
    if let Some(path) = picked.clone() {
        let mut settings = state.settings.read().map_err(err)?.clone();
        settings.temp_path = Some(path);
        state.apply_and_save_settings(settings).map_err(err)?;
    }
    Ok(picked)
}

#[tauri::command]
pub async fn pick_archive_folder_save(
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Option<String>, String> {
    pick_archive_folder_impl(state, app).await
}

#[tauri::command]
pub async fn pick_archive_folder(state: State<'_, AppArc>, app: AppHandle) -> Result<Option<String>, String> {
    pick_archive_folder_impl(state, app).await
}

async fn pick_archive_folder_impl(state: State<'_, AppArc>, app: AppHandle) -> Result<Option<String>, String> {
    let picked = pick_folder_dialog(&app).await?;
    if let Some(path) = picked.clone() {
        let mut settings = state.settings.read().map_err(err)?.clone();
        settings.archive_path = Some(path);
        state.apply_and_save_settings(settings).map_err(err)?;
    }
    Ok(picked)
}

#[tauri::command]
pub fn list_voices() -> Vec<String> {
    VOICES.iter().map(|s| s.to_string()).collect()
}

#[tauri::command]
pub async fn list_models(state: State<'_, AppArc>) -> Result<Vec<TtsModelInfo>, String> {
    state.tts.list_tts_models().await.map_err(err)
}

#[tauri::command]
pub fn get_session_id(state: State<'_, AppArc>) -> String {
    state.session_id.clone()
}

#[tauri::command]
pub fn get_cursor_integration_status(state: State<'_, AppArc>) -> Result<IntegrationStatus, String> {
    let mut s = cursor_integration::status().map_err(err)?;
    s.last_cursor_at = state.db.last_cursor_at().map_err(err)?;
    Ok(s)
}

#[tauri::command]
pub fn install_cursor_hooks(state: State<'_, AppArc>) -> Result<InstallReport, String> {
    let settings = state.settings.read().map_err(err)?.clone();
    let report = cursor_integration::install_hooks(&settings).map_err(err)?;
    {
        let mut s = state.settings.write().map_err(err)?;
        s.cursor_integration.last_install_ts = Some(report.ts);
        s.cursor_integration.enabled = true;
    }
    state.persist_settings().map_err(err)?;
    Ok(report)
}

#[tauri::command]
pub fn uninstall_cursor_hooks(
    remove_script: bool,
    remove_config: bool,
) -> Result<UninstallReport, String> {
    cursor_integration::uninstall_hooks(remove_script, remove_config).map_err(err)
}

#[tauri::command]
pub fn export_cursor_hook_config(state: State<'_, AppArc>) -> Result<String, String> {
    let settings = state.settings.read().map_err(err)?.clone();
    let path = cursor_integration::export_config(&settings).map_err(err)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_cursor_integration(
    cfg: CursorIntegration,
    state: State<'_, AppArc>,
) -> Result<CursorIntegration, String> {
    {
        let mut s = state.settings.write().map_err(err)?;
        s.cursor_integration = cfg.clone();
    }
    state.persist_settings().map_err(err)?;
    let _ = cursor_integration::export_config(&state.settings.read().map_err(err)?.clone());
    Ok(cfg)
}

#[tauri::command]
pub fn set_cursor_dnd(minutes: i64, state: State<'_, AppArc>) -> Result<Option<i64>, String> {
    let now = chrono::Utc::now().timestamp_millis();
    let new_ts = if minutes <= 0 {
        None
    } else {
        Some(now + minutes * 60_000)
    };
    {
        let mut s = state.settings.write().map_err(err)?;
        s.cursor_integration.dnd_until_ts = new_ts;
    }
    state.persist_settings().map_err(err)?;
    let _ = cursor_integration::export_config(&state.settings.read().map_err(err)?.clone());
    Ok(new_ts)
}

#[tauri::command]
pub fn list_voice_samples(model: String, state: State<'_, AppArc>) -> Vec<VoiceSampleInfo> {
    let paths = state.paths.read().ok();
    paths
        .map(|p| voice_samples::list_status(&p, &model))
        .unwrap_or_default()
}

#[tauri::command]
pub async fn ensure_voice_sample(
    model: String,
    voice: String,
    state: State<'_, AppArc>,
) -> Result<String, String> {
    let path = voice_samples::ensure_sample(state.inner(), &model, &voice).await?;
    Ok(path.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceSampleProgress {
    pub voice: String,
    pub index: usize,
    pub total: usize,
    pub ready: bool,
}

#[tauri::command]
pub async fn generate_all_voice_samples(
    model: String,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Vec<VoiceSampleInfo>, String> {
    let state = state.inner().clone();
    let total = VOICES.len();
    for (index, voice) in VOICES.iter().enumerate() {
        let voice = (*voice).to_string();
        let _ = app.emit(
            "voice-samples:progress",
            VoiceSampleProgress {
                voice: voice.clone(),
                index,
                total,
                ready: false,
            },
        );
        voice_samples::ensure_sample(&state, &model, &voice).await?;
        let _ = app.emit(
            "voice-samples:progress",
            VoiceSampleProgress {
                voice: voice.clone(),
                index,
                total,
                ready: true,
            },
        );
    }
    let paths = state.paths.read().map_err(err)?;
    Ok(voice_samples::list_status(&paths, &model))
}

#[cfg(windows)]
fn reveal_path(path: &str) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(format!("/select,{}", path))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn reveal_path(path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", path])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal_path(path: &str) -> Result<(), String> {
    let parent = std::path::Path::new(path)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    std::process::Command::new("xdg-open")
        .arg(parent)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn open_folder(path: &str) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn open_folder(path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_folder(path: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
