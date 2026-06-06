//! Tauri IPC commands for chat sessions and messages.
//!
//! Frontend calls these via `invoke("chat_*", { ... })`. The HTTP API
//! (`http_api::chat_*_http`) is a thin wrapper over the same logic in
//! `chat::db` — both should produce identical results.
//!
//! For mutation commands that should also notify the frontend, the Tauri
//! event bus is used: `chat:session_changed`, `chat:message_added`.

use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use crate::chat::{db, types::*};
use crate::state::AppState;

/// The Tauri app is registered with `app.manage(Arc::new(AppState::initialize()))`,
/// so commands receive `State<'_, Arc<AppState>>`.
type AppArc = Arc<AppState>;

fn lock_db<'a>(state: &'a State<'_, AppArc>) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    Ok(state.db.conn())
}

#[tauri::command]
pub fn chat_create_session(
    state: State<'_, AppArc>,
    app: AppHandle,
    source: String,
    title: Option<String>,
) -> Result<ChatSession, String> {
    let s = {
        let conn = lock_db(&state)?;
        db::create_session(&conn, &source, title.as_deref()).map_err(|e| e.to_string())?
    };
    let _ = app.emit("chat:session_changed", &serde_json::json!({"id": s.id}));
    Ok(s)
}

#[tauri::command]
pub fn chat_list_sessions(
    state: State<'_, AppArc>,
    source: Option<String>,
    saved_only: Option<bool>,
) -> Result<Vec<ChatSession>, String> {
    let conn = lock_db(&state)?;
    db::list_sessions(&conn, source.as_deref(), saved_only.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_get_session(
    state: State<'_, AppArc>,
    id: String,
) -> Result<Option<ChatSession>, String> {
    let conn = lock_db(&state)?;
    db::get_session(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_update_session(
    state: State<'_, AppArc>,
    app: AppHandle,
    id: String,
    title: Option<String>,
    is_saved: Option<bool>,
) -> Result<(), String> {
    {
        let conn = lock_db(&state)?;
        db::update_session(&conn, &id, title.as_deref(), is_saved).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("chat:session_changed", &serde_json::json!({"id": id}));
    Ok(())
}

#[tauri::command]
pub fn chat_delete_session(
    state: State<'_, AppArc>,
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    {
        let conn = lock_db(&state)?;
        db::delete_session(&conn, &id).map_err(|e| e.to_string())?;
    }
    let _ = app.emit(
        "chat:session_changed",
        &serde_json::json!({"id": id, "deleted": true}),
    );
    Ok(())
}

#[tauri::command]
pub fn chat_list_messages(
    state: State<'_, AppArc>,
    session_id: String,
) -> Result<Vec<ChatMessage>, String> {
    let conn = lock_db(&state)?;
    db::list_messages(&conn, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_add_message(
    state: State<'_, AppArc>,
    app: AppHandle,
    session_id: String,
    role: String,
    content: String,
    generation_id: Option<String>,
) -> Result<ChatMessage, String> {
    let m = {
        let conn = lock_db(&state)?;
        db::add_message(
            &conn,
            &session_id,
            &role,
            &content,
            generation_id.as_deref(),
        )
        .map_err(|e| e.to_string())?
    };
    let _ = app.emit(
        "chat:message_added",
        &serde_json::json!({"session_id": session_id, "message_id": m.id}),
    );
    Ok(m)
}

/// Returns the generation_id (audio file pointer) for a chat message, or an
/// error if the message has no audio. Used by the frontend to look up the
/// audio URL via `playbackAudioSrc(generation_id)`.
#[tauri::command]
pub fn chat_replay_message(
    state: State<'_, AppArc>,
    message_id: String,
) -> Result<String, String> {
    let conn = lock_db(&state)?;
    db::message_generation_id(&conn, &message_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("message {message_id} has no audio"))
}

#[tauri::command]
pub fn chat_list_recent_sources(state: State<'_, AppArc>) -> Result<Vec<(String, i64)>, String> {
    let conn = lock_db(&state)?;
    // 30 days window
    db::list_recent_sources(&conn, 30 * 24 * 3600 * 1000).map_err(|e| e.to_string())
}
