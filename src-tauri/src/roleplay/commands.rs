use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::commands::GenerateReq;
use crate::google::SpeakerConfig;
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

