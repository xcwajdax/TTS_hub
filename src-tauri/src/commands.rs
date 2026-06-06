use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

use crate::app_settings::{AppSettings, CursorIntegration, PROVIDER_MINIMAX};
use crate::quick_hotkeys;
use crate::quick_setup_window;
use crate::playback_toast_window;
use crate::toast_window;
use crate::text_filters::{self, TextFilterPreset};
use crate::audio::{convert_audio_file, AudioFormat};
use crate::avatars::{self, AvatarInfo};
use crate::cursor_integration::{self, InstallReport, IntegrationStatus, UninstallReport};
use crate::db::{
    Folder, FolderRule, FolderRuleInput, Generation, Tag, UsageSummary, STATUS_CANCELLED,
    STATUS_DONE, STATUS_INTERRUPTED, STATUS_QUEUED,
};
use crate::google::{GoogleTts, SpeakerConfig, TtsModelInfo, VOICES};
use crate::minimax::{
    MinimaxClonedVoice, MinimaxHealth, MinimaxLanguageInfo, MinimaxModelInfo, MinimaxPresetVoice,
    MinimaxSyncVoicesResult,
};
use crate::paths::AppPaths;
use crate::paths::{rename_dir, slugify_name, unique_slug};
use crate::state::AppState;
use crate::voice_samples::{self, VoiceSampleInfo};
use crate::voicebox::{VoiceBoxHealth, VoiceBoxProfile};

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
    pub provider: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub personality: Option<bool>,
    #[serde(default)]
    pub autoplay: bool,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub summary_text: Option<String>,
    #[serde(default)]
    pub filtered_text: Option<String>,
    #[serde(default)]
    pub filter_config: Option<TextFilterPreset>,
    #[serde(default)]
    pub minimax_speed: Option<f32>,
    #[serde(default)]
    pub minimax_vol: Option<f32>,
    #[serde(default)]
    pub minimax_pitch: Option<i32>,
    // === chat-window extension (2026-06-06) — additive, optional ===
    /// Original user prompt that produced this assistant reply. Stored on
    /// the generation for context/replay. Does NOT affect TTS output.
    #[serde(default)]
    pub original_prompt: Option<String>,
    /// If set, the generation is also recorded in this chat session. The
    /// session is auto-created if it doesn't exist.
    #[serde(default)]
    pub chat_session_id: Option<String>,
    /// "assistant" (default) | "user" | "system". Used when adding a chat
    /// message tied to this generation.
    #[serde(default)]
    pub chat_role: Option<String>,
}

fn resolve_filtered_text(mut req: GenerateReq) -> Result<GenerateReq, String> {
    let has_filtered = req
        .filtered_text
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if has_filtered {
        return Ok(req);
    }
    if let Some(preset) = req.filter_config.clone() {
        let result = text_filters::apply_text_filters(&req.text, &preset);
        if result.output.trim().is_empty() {
            return Err("text is empty after filters".into());
        }
        req.filtered_text = Some(result.output);
    }
    Ok(req)
}

fn synth_text_for_title(req: &GenerateReq) -> &str {
    if let Some(s) = req.summary_text.as_deref() {
        if !s.trim().is_empty() {
            return s;
        }
    }
    if let Some(s) = req.filtered_text.as_deref() {
        if !s.trim().is_empty() {
            return s;
        }
    }
    &req.text
}

/// Persist a queued row + push to the worker pool. Returns the queued Generation row.
/// Used by both the Tauri command and the HTTP /generate endpoint.
pub fn enqueue_request(state: &AppArc, req: GenerateReq) -> Result<Generation, String> {
    let req = resolve_filtered_text(req)?;
    if req.text.trim().is_empty() {
        return Err("text is empty".into());
    }
    if let Some(ft) = req.filtered_text.as_deref() {
        if ft.trim().is_empty() {
            return Err("text is empty after filters".into());
        }
    }
    AudioFormat::from_str(&req.format).ok_or_else(|| "unknown format".to_string())?;

    let id = uuid::Uuid::new_v4().to_string();
    let now_ms = chrono::Utc::now().timestamp_millis();
    let title = derive_title(synth_text_for_title(&req));
    let source = req
        .source
        .as_ref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "manual".to_string());
    let matched_folder_id = state.db.folder_rule_match(&source).map_err(err)?;
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
        provider: req.provider.clone(),
        input_chars: None,
        prompt_tokens: None,
        output_tokens: None,
        total_tokens: None,
        folder_id: matched_folder_id,
        ui_color: None,
        tag_ids: None,
        original_prompt: req.original_prompt.clone(),
        chat_session_id: None, // set after chat message is created below
        chat_message_id: None,
    };

    // === chat-window extension (2026-06-06) ===
    // If chat_session_id is provided, auto-create the session if it doesn't
    // exist, then insert a user message (with original_prompt) and an
    // assistant message (with `text`, generation_id=NULL for now). The
    // assistant message will be back-linked to this generation after we
    // enqueue, and the message's `generation_id` will be patched once the
    // job completes (TODO: job done event hook).
    if let Some(sid) = req.chat_session_id.as_deref() {
        let conn = state.db.conn();
        // Auto-create the session if it doesn't exist (silently — this is
        // the "auto-detection" feature). Source defaults to "unknown" if
        // not derivable from the request.
        if crate::chat::db::get_session(&conn, sid).map_err(err)?.is_none() {
            let source_name = req
                .source
                .clone()
                .unwrap_or_else(|| "unknown".to_string());
            crate::chat::db::create_session(&conn, &source_name, None).map_err(err)?;
        }
        // User message: the original prompt that produced this reply.
        if let Some(prompt) = req.original_prompt.as_deref() {
            crate::chat::db::add_message(&conn, sid, "user", prompt, None).map_err(err)?;
        }
        // Assistant message: the text being synthesized. generation_id is
        // back-filled when the job finishes; for now we link via the gen
        // row's chat_message_id so the message knows its own ID.
        let assistant_msg =
            crate::chat::db::add_message(&conn, sid, "assistant", &req.text, None)
                .map_err(err)?;
        drop(conn);
        // Stash the resolved session+message IDs on the generation row.
        let mut gen = gen;
        gen.chat_session_id = Some(sid.to_string());
        gen.chat_message_id = Some(assistant_msg.id.clone());
        state.db.insert(&gen).map_err(err)?;
        // Back-link the assistant message to this generation id.
        // We do this with a direct UPDATE because we already created the
        // message with generation_id=NULL.
        let conn2 = state.db.conn();
        let _ = conn2.execute(
            "UPDATE chat_messages SET generation_id = ?1 WHERE id = ?2",
            rusqlite::params![gen.id, assistant_msg.id],
        );
        let queue = state
            .job_queue()
            .ok_or_else(|| "job queue not initialized".to_string())?;
        queue.enqueue(gen.id.clone()).map_err(err)?;
        return Ok(gen);
    }
    state.db.insert(&gen).map_err(err)?;

    let queue = state
        .job_queue()
        .ok_or_else(|| "job queue not initialized".to_string())?;
    queue.enqueue(id.clone()).map_err(err)?;
    Ok(gen)
}

#[tauri::command]
pub async fn generate(req: GenerateReq, state: State<'_, AppArc>) -> Result<Generation, String> {
    let state = state.inner().clone();
    enqueue_request(&state, req)
}

#[tauri::command]
pub fn get_token_usage(state: State<'_, AppArc>) -> Result<UsageSummary, String> {
    state.db.usage_summary(&state.session_id).map_err(err)
}

fn attach_tag_ids(db: &crate::db::Db, gens: &mut [Generation]) -> Result<(), String> {
    let ids: Vec<String> = gens.iter().map(|g| g.id.clone()).collect();
    let map = db.generation_tags_for_ids(&ids).map_err(err)?;
    for g in gens.iter_mut() {
        let tids = map.get(&g.id).cloned().unwrap_or_default();
        g.tag_ids = if tids.is_empty() { None } else { Some(tids) };
    }
    Ok(())
}

#[tauri::command]
pub fn list_history(
    scope: String,
    folder_id: Option<String>,
    state: State<'_, AppArc>,
) -> Result<Vec<Generation>, String> {
    match scope.as_str() {
        "session" => state.db.list_temp_history().map_err(err),
        "cursor" => state
            .db
            .list_cursor_feed(&state.session_id, 30)
            .map_err(err),
        "archive" => {
            let mut gens = match folder_id.as_deref() {
                Some("__all__") | None => state.db.list_archive().map_err(err)?,
                Some("__none__") => state.db.list_generations_in_folder(None).map_err(err)?,
                Some(fid) => state
                    .db
                    .list_generations_in_folder(Some(fid))
                    .map_err(err)?,
            };
            attach_tag_ids(&state.db, &mut gens)?;
            Ok(gens)
        }
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
        "all" => &["queued", "running", "interrupted", "failed", "cancelled"],
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
            state
                .db
                .update_status(&id, STATUS_CANCELLED, None)
                .map_err(err)?;
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
    let rows = state
        .db
        .list_by_statuses(&[STATUS_INTERRUPTED])
        .map_err(err)?;
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
    let rows = state
        .db
        .list_by_statuses(&[STATUS_INTERRUPTED])
        .map_err(err)?;
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
pub fn update_generation_ui_color(
    id: String,
    ui_color: Option<String>,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    if let Some(ref c) = ui_color {
        let t = c.trim();
        if t.is_empty() {
            return Err("kolor nie może być pusty".into());
        }
        if !t.starts_with('#') || (t.len() != 7 && t.len() != 4) {
            return Err("kolor musi być w formacie #RGB lub #RRGGBB".into());
        }
        for ch in t.chars().skip(1) {
            if !ch.is_ascii_hexdigit() {
                return Err("nieprawidłowy kolor hex".into());
            }
        }
    }
    state
        .db
        .update_ui_color(&id, ui_color.as_deref())
        .map_err(err)?;
    let mut g = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    g.ui_color = ui_color;
    Ok(g)
}

#[tauri::command]
pub fn archive_generation(
    id: String,
    format: String,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    let target = AudioFormat::from_str(&format).ok_or_else(|| "unknown format".to_string())?;
    do_archive(&state, id, target, None)
}

/// Move or copy audio into archive. `folder_id`: `None` = root archive; `Some` = subfolder.
pub fn do_archive(
    state: &AppArc,
    id: String,
    target: AudioFormat,
    folder_id: Option<String>,
) -> Result<Generation, String> {
    let id = id.as_str();
    let mut g = state
        .db
        .get(id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    let src = PathBuf::from(&g.file_path);
    if !src.is_file() {
        return Err("source audio file missing".into());
    }
    let paths = read_paths(state)?;
    let dst_dir = if let Some(ref fid) = folder_id {
        let folder = state
            .db
            .folder_by_id(fid)
            .map_err(err)?
            .ok_or_else(|| "folder not found".to_string())?;
        let dir = paths.folder_dir(&folder);
        std::fs::create_dir_all(&dir).map_err(err)?;
        dir
    } else {
        std::fs::create_dir_all(&paths.archive).map_err(err)?;
        paths.archive.clone()
    };
    let dst = dst_dir.join(format!("{id}.{}", target.ext()));
    drop(paths);

    let current = AudioFormat::from_str(&g.format).unwrap_or(AudioFormat::Wav);
    if g.is_archived && src == dst {
        state
            .db
            .update_archived(
                id,
                true,
                &dst.to_string_lossy(),
                &target.ext().to_string(),
                folder_id.as_deref(),
            )
            .map_err(err)?;
        g.folder_id = folder_id;
        return Ok(g);
    }
    if dst.exists() {
        let _ = std::fs::remove_file(&dst);
    }
    if current == target {
        if g.is_archived {
            std::fs::rename(&src, &dst).map_err(err)?;
        } else {
            std::fs::copy(&src, &dst).map_err(err)?;
            let _ = std::fs::remove_file(&src);
        }
    } else {
        convert_audio_file(&src, &dst, target).map_err(err)?;
        if g.is_archived {
            let _ = std::fs::remove_file(&src);
        } else {
            let _ = std::fs::remove_file(&src);
        }
    }

    let dst_str = dst.to_string_lossy().to_string();
    let format_str = target.ext().to_string();
    state
        .db
        .update_archived(id, true, &dst_str, &format_str, folder_id.as_deref())
        .map_err(err)?;
    g.is_archived = true;
    g.file_path = dst_str;
    g.format = format_str;
    g.folder_id = folder_id;
    Ok(g)
}

pub fn list_folders_impl(state: &AppArc) -> Result<Vec<Folder>, String> {
    state.db.folder_list().map_err(err)
}

#[tauri::command]
pub fn list_folders(state: State<'_, AppArc>) -> Result<Vec<Folder>, String> {
    list_folders_impl(state.inner())
}

pub fn create_folder_impl(
    state: &AppArc,
    name: String,
    color: Option<String>,
) -> Result<Folder, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("folder name is empty".into());
    }
    let base_slug = slugify_name(trimmed);
    let existing = state.db.folder_slugs().map_err(err)?;
    let slug = unique_slug(&base_slug, &existing);
    let now = chrono::Utc::now().timestamp_millis();
    let sort_order = state.db.folder_max_sort_order().map_err(err)? + 1;
    let folder = Folder {
        id: uuid::Uuid::new_v4().to_string(),
        name: trimmed.to_string(),
        slug: slug.clone(),
        color: color.filter(|c| !c.trim().is_empty()),
        sort_order,
        created_at: now,
    };
    state.db.folder_insert(&folder).map_err(err)?;
    let paths = read_paths(state)?;
    std::fs::create_dir_all(paths.folder_dir(&folder)).map_err(err)?;
    Ok(folder)
}

#[tauri::command]
pub fn create_folder(
    name: String,
    color: Option<String>,
    state: State<'_, AppArc>,
) -> Result<Folder, String> {
    create_folder_impl(state.inner(), name, color)
}

pub fn rename_folder_impl(state: &AppArc, id: String, new_name: String) -> Result<Folder, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("folder name is empty".into());
    }
    let folder = state
        .db
        .folder_by_id(&id)
        .map_err(err)?
        .ok_or_else(|| "folder not found".to_string())?;
    let base_slug = slugify_name(trimmed);
    let existing: Vec<String> = state
        .db
        .folder_slugs()
        .map_err(err)?
        .into_iter()
        .filter(|s| s != &folder.slug)
        .collect();
    let new_slug = unique_slug(&base_slug, &existing);
    let paths = read_paths(state)?;
    let old_dir = paths.folder_dir(&folder);
    let new_folder = Folder {
        name: trimmed.to_string(),
        slug: new_slug.clone(),
        ..folder.clone()
    };
    let new_dir = paths.folder_dir(&new_folder);
    if old_dir != new_dir {
        rename_dir(&old_dir, &new_dir).map_err(err)?;
        let gen_paths = state.db.generation_paths_for_folder(&id).map_err(err)?;
        for (gid, old_path) in gen_paths {
            let old_pb = PathBuf::from(&old_path);
            if let Ok(rel) = old_pb.strip_prefix(&old_dir) {
                let new_path = new_dir.join(rel);
                if old_pb != new_path {
                    let _ = std::fs::rename(&old_pb, &new_path);
                    if let Ok(Some(g)) = state.db.get(&gid) {
                        let new_path_str = new_path.to_string_lossy().to_string();
                        state
                            .db
                            .update_archived(
                                &gid,
                                g.is_archived,
                                &new_path_str,
                                &g.format,
                                g.folder_id.as_deref(),
                            )
                            .map_err(err)?;
                    }
                }
            }
        }
    }
    state
        .db
        .folder_update_meta(&id, trimmed, &new_slug, folder.color.as_deref())
        .map_err(err)?;
    state
        .db
        .folder_by_id(&id)
        .map_err(err)?
        .ok_or_else(|| "folder not found".into())
}

#[tauri::command]
pub fn rename_folder(
    id: String,
    new_name: String,
    state: State<'_, AppArc>,
) -> Result<Folder, String> {
    rename_folder_impl(state.inner(), id, new_name)
}

pub fn delete_folder_impl(state: &AppArc, id: String, mode: String) -> Result<(), String> {
    let folder = state
        .db
        .folder_by_id(&id)
        .map_err(err)?
        .ok_or_else(|| "folder not found".to_string())?;
    let paths = read_paths(state)?;
    let folder_dir = paths.folder_dir(&folder);

    match mode.as_str() {
        "unassign" => {
            let gens = state.db.generation_paths_for_folder(&id).map_err(err)?;
            for (gid, file_path) in gens {
                if let Ok(Some(g)) = state.db.get(&gid) {
                    if g.status != STATUS_DONE {
                        continue;
                    }
                    let target = AudioFormat::from_str(&g.format).unwrap_or(AudioFormat::Wav);
                    let _ = do_archive(&state, gid.clone(), target, None);
                } else if !file_path.is_empty() {
                    let src = PathBuf::from(&file_path);
                    if src.is_file() {
                        let dst = paths.archive.join(
                            src.file_name()
                                .unwrap_or_else(|| std::ffi::OsStr::new("audio.wav")),
                        );
                        let _ = std::fs::rename(&src, &dst);
                    }
                }
            }
            state.db.unassign_folder_generations(&id).map_err(err)?;
        }
        "delete_items" => {
            let gens = state.db.generation_paths_for_folder(&id).map_err(err)?;
            for (gid, file_path) in gens {
                if !file_path.is_empty() {
                    let _ = std::fs::remove_file(&file_path);
                }
                let _ = state.db.delete(&gid);
            }
        }
        _ => return Err("mode must be unassign or delete_items".into()),
    }

    let _ = std::fs::remove_dir_all(&folder_dir);
    state.db.folder_delete(&id).map_err(err)?;
    Ok(())
}

#[tauri::command]
pub fn delete_folder(id: String, mode: String, state: State<'_, AppArc>) -> Result<(), String> {
    delete_folder_impl(state.inner(), id, mode)
}

pub fn list_tags_impl(state: &AppArc) -> Result<Vec<Tag>, String> {
    state.db.tag_list().map_err(err)
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppArc>) -> Result<Vec<Tag>, String> {
    list_tags_impl(state.inner())
}

pub fn create_tag_impl(state: &AppArc, name: String, color: Option<String>) -> Result<Tag, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("tag name is empty".into());
    }
    let base_slug = slugify_name(trimmed);
    let existing = state.db.tag_slugs().map_err(err)?;
    let slug = unique_slug(&base_slug, &existing);
    let now = chrono::Utc::now().timestamp_millis();
    let sort_order = state.db.tag_max_sort_order().map_err(err)? + 1;
    let tag = Tag {
        id: uuid::Uuid::new_v4().to_string(),
        name: trimmed.to_string(),
        slug,
        color: color.filter(|c| !c.trim().is_empty()),
        sort_order,
        created_at: now,
    };
    state.db.tag_insert(&tag).map_err(err)?;
    Ok(tag)
}

#[tauri::command]
pub fn create_tag(
    name: String,
    color: Option<String>,
    state: State<'_, AppArc>,
) -> Result<Tag, String> {
    create_tag_impl(state.inner(), name, color)
}

pub fn rename_tag_impl(state: &AppArc, id: String, new_name: String) -> Result<Tag, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("tag name is empty".into());
    }
    let tag = state
        .db
        .tag_by_id(&id)
        .map_err(err)?
        .ok_or_else(|| "tag not found".to_string())?;
    let base_slug = slugify_name(trimmed);
    let existing: Vec<String> = state
        .db
        .tag_slugs()
        .map_err(err)?
        .into_iter()
        .filter(|s| s != &tag.slug)
        .collect();
    let new_slug = unique_slug(&base_slug, &existing);
    state
        .db
        .tag_update_meta(&id, trimmed, &new_slug, tag.color.as_deref())
        .map_err(err)?;
    state
        .db
        .tag_by_id(&id)
        .map_err(err)?
        .ok_or_else(|| "tag not found".into())
}

#[tauri::command]
pub fn rename_tag(id: String, new_name: String, state: State<'_, AppArc>) -> Result<Tag, String> {
    rename_tag_impl(state.inner(), id, new_name)
}

pub fn delete_tag_impl(state: &AppArc, id: String) -> Result<(), String> {
    if state.db.tag_by_id(&id).map_err(err)?.is_none() {
        return Err("tag not found".into());
    }
    state.db.tag_delete(&id).map_err(err)?;
    Ok(())
}

#[tauri::command]
pub fn delete_tag(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    delete_tag_impl(state.inner(), id)
}

pub fn set_generation_tags_impl(
    state: &AppArc,
    generation_id: String,
    tag_ids: Vec<String>,
) -> Result<Generation, String> {
    let mut g = state
        .db
        .get(&generation_id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if !g.is_archived {
        return Err("tags can only be assigned to archived generations".into());
    }
    for tid in &tag_ids {
        if state.db.tag_by_id(tid).map_err(err)?.is_none() {
            return Err(format!("tag not found: {tid}"));
        }
    }
    state
        .db
        .set_generation_tags(&generation_id, &tag_ids)
        .map_err(err)?;
    g.tag_ids = if tag_ids.is_empty() {
        None
    } else {
        Some(tag_ids)
    };
    Ok(g)
}

#[tauri::command]
pub fn set_generation_tags(
    generation_id: String,
    tag_ids: Vec<String>,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    set_generation_tags_impl(state.inner(), generation_id, tag_ids)
}

pub fn move_to_folder_impl(
    state: &AppArc,
    generation_id: String,
    folder_id: Option<String>,
) -> Result<Generation, String> {
    let g = state
        .db
        .get(&generation_id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if g.status != STATUS_DONE {
        return Err("can only move completed generations".into());
    }
    let target = AudioFormat::from_str(&g.format).unwrap_or(AudioFormat::Wav);
    do_archive(state, generation_id, target, folder_id)
}

#[tauri::command]
pub fn move_to_folder(
    generation_id: String,
    folder_id: Option<String>,
    state: State<'_, AppArc>,
) -> Result<Generation, String> {
    move_to_folder_impl(state.inner(), generation_id, folder_id)
}

pub fn list_folder_rules_impl(state: &AppArc) -> Result<Vec<FolderRule>, String> {
    state.db.folder_rules_list().map_err(err)
}

#[tauri::command]
pub fn list_folder_rules(state: State<'_, AppArc>) -> Result<Vec<FolderRule>, String> {
    list_folder_rules_impl(state.inner())
}

pub fn upsert_folder_rule_impl(
    state: &AppArc,
    rule: FolderRuleInput,
) -> Result<FolderRule, String> {
    if state
        .db
        .folder_by_id(&rule.folder_id)
        .map_err(err)?
        .is_none()
    {
        return Err("folder not found".into());
    }
    let match_source = rule.match_source.trim().to_lowercase();
    if match_source.is_empty() {
        return Err("match_source is empty".into());
    }
    let now = chrono::Utc::now().timestamp_millis();
    let stored = FolderRule {
        id: rule
            .id
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        folder_id: rule.folder_id,
        match_source,
        priority: rule.priority,
        enabled: rule.enabled,
        created_at: now,
    };
    state.db.folder_rule_upsert(&stored).map_err(err)?;
    Ok(stored)
}

#[tauri::command]
pub fn upsert_folder_rule(
    rule: FolderRuleInput,
    state: State<'_, AppArc>,
) -> Result<FolderRule, String> {
    upsert_folder_rule_impl(state.inner(), rule)
}

pub fn delete_folder_rule_impl(state: &AppArc, id: String) -> Result<(), String> {
    state.db.folder_rule_delete(&id).map_err(err)
}

#[tauri::command]
pub fn delete_folder_rule(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    delete_folder_rule_impl(state.inner(), id)
}

#[tauri::command]
pub fn delete_generation(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    if let Some(g) = state.db.get(&id).map_err(err)? {
        let _ = std::fs::remove_file(&g.file_path);
    }
    state.db.delete(&id).map_err(err)?;
    state.apply_temp_retention().map_err(err)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(err)
}

#[tauri::command]
pub fn export_generation_to_path(
    id: String,
    dest_path: String,
    state: State<'_, AppArc>,
) -> Result<(), String> {
    let g = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if g.file_path.trim().is_empty() {
        return Err("brak pliku audio dla tej generacji".into());
    }
    let src = PathBuf::from(&g.file_path);
    if !src.is_file() {
        return Err("plik źródłowy nie istnieje".into());
    }
    let dest = PathBuf::from(&dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    std::fs::copy(&src, &dest).map_err(err)?;
    Ok(())
}

#[tauri::command]
pub fn copy_generation_audio_to_clipboard(
    id: String,
    state: State<'_, AppArc>,
) -> Result<(), String> {
    let g = state
        .db
        .get(&id)
        .map_err(err)?
        .ok_or_else(|| "not found".to_string())?;
    if g.file_path.trim().is_empty() {
        return Err("brak pliku audio dla tej generacji".into());
    }
    let path = PathBuf::from(&g.file_path);
    if !path.is_file() {
        return Err("plik audio nie istnieje".into());
    }
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("schowek: {e}"))?;
    clipboard
        .set()
        .file_list(&[path.as_path()])
        .map_err(|e| format!("kopiowanie do schowka: {e}"))?;
    Ok(())
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
    pub env_minimax_api_key_available: bool,
    pub effective_voicebox_url: String,
    pub env_voicebox_url: String,
    pub effective_minimax_configured: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProbeResult {
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_count: Option<usize>,
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppArc>) -> Result<AppSettingsView, String> {
    let settings = state.settings.read().map_err(err)?.clone();
    let paths = read_paths(&state)?;
    let effective_voicebox_url = settings.effective_voicebox_url(&state.env_voicebox_url);
    let effective_minimax_key = settings.effective_minimax_key(&state.env_minimax_key);
    Ok(AppSettingsView {
        settings,
        effective_temp_path: paths.temp.to_string_lossy().to_string(),
        effective_archive_path: paths.archive.to_string_lossy().to_string(),
        env_api_key_available: !state.env_google_key.trim().is_empty(),
        env_minimax_api_key_available: !state.env_minimax_key.trim().is_empty(),
        effective_voicebox_url,
        env_voicebox_url: state.env_voicebox_url.clone(),
        effective_minimax_configured: !effective_minimax_key.trim().is_empty(),
    })
}

#[tauri::command]
pub fn set_app_settings(
    settings: AppSettings,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<AppSettingsView, String> {
    state.apply_and_save_settings(settings).map_err(err)?;
    state.apply_temp_retention().map_err(err)?;
    quick_hotkeys::reload_from_settings(&app, state.inner())?;
    get_app_settings(state)
}

#[tauri::command]
pub fn test_quick_hotkey_preset(
    preset_id: String,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Generation, String> {
    quick_hotkeys::run_preset(&app, state.inner(), &preset_id)
}

#[tauri::command]
pub fn hide_quick_hotkey_toast(app: AppHandle) -> Result<(), String> {
    toast_window::hide(&app);
    Ok(())
}

#[tauri::command]
pub fn show_playback_toast(app: AppHandle, generation: Generation) -> Result<(), String> {
    playback_toast_window::show(&app, generation)
}

#[tauri::command]
pub fn hide_playback_toast(app: AppHandle) -> Result<(), String> {
    playback_toast_window::hide(&app);
    Ok(())
}

#[tauri::command]
pub fn open_quick_setup_window(app: AppHandle) -> Result<(), String> {
    quick_setup_window::open(&app)
}

#[tauri::command]
pub fn close_quick_setup_window(app: AppHandle) -> Result<(), String> {
    quick_setup_window::close(&app);
    Ok(())
}

async fn pick_folder_dialog(app: &AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    app.dialog().file().pick_folder(move |f| {
        let _ = tx.send(f.map(|p| p.to_string()));
    });
    rx.await.map_err(err)
}

#[tauri::command]
pub async fn pick_temp_folder(
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Option<String>, String> {
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
pub async fn pick_archive_folder(
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Option<String>, String> {
    pick_archive_folder_impl(state, app).await
}

async fn pick_archive_folder_impl(
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Option<String>, String> {
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
pub async fn probe_google(api_key: String) -> Result<ProbeResult, String> {
    match GoogleTts::probe_api_key(&api_key).await {
        Ok(count) => Ok(ProbeResult {
            ok: true,
            message: format!("Połączenie OK — wykryto {count} modeli TTS."),
            model_count: Some(count),
        }),
        Err(message) => Ok(ProbeResult {
            ok: false,
            message,
            model_count: None,
        }),
    }
}

#[tauri::command]
pub async fn probe_voicebox(base_url: String) -> Result<ProbeResult, String> {
    let client = crate::voicebox::VoiceBoxClient::new(base_url);
    match client.health().await {
        Ok(h) => Ok(ProbeResult {
            ok: true,
            message: format!(
                "Voice Box OK — status: {}, model_loaded: {}",
                h.status, h.model_loaded
            ),
            model_count: None,
        }),
        Err(e) => Ok(ProbeResult {
            ok: false,
            message: format!("{e:#}"),
            model_count: None,
        }),
    }
}

#[tauri::command]
pub async fn probe_minimax(api_key: String) -> Result<ProbeResult, String> {
    let client = crate::minimax::MinimaxClient::new(api_key);
    match client.probe_connection().await {
        Ok(()) => Ok(ProbeResult {
            ok: true,
            message: "Połączenie WebSocket z MiniMax OK.".into(),
            model_count: None,
        }),
        Err(e) => Ok(ProbeResult {
            ok: false,
            message: format!("{e:#}"),
            model_count: None,
        }),
    }
}

#[tauri::command]
pub async fn voicebox_health(state: State<'_, AppArc>) -> Result<VoiceBoxHealth, String> {
    state.voicebox.health().await.map_err(err)
}

#[tauri::command]
pub async fn list_voicebox_profiles(
    state: State<'_, AppArc>,
) -> Result<Vec<VoiceBoxProfile>, String> {
    state.voicebox.profiles().await.map_err(err)
}

#[tauri::command]
pub async fn list_voicebox_models(state: State<'_, AppArc>) -> Result<Vec<TtsModelInfo>, String> {
    state.voicebox.list_tts_models().await.map_err(err)
}

#[tauri::command]
pub async fn minimax_health(state: State<'_, AppArc>) -> Result<MinimaxHealth, String> {
    Ok(state.minimax.health().await)
}

#[tauri::command]
pub fn list_minimax_models() -> Vec<MinimaxModelInfo> {
    crate::minimax::MinimaxClient::list_models()
}

#[tauri::command]
pub fn list_minimax_languages() -> Vec<MinimaxLanguageInfo> {
    crate::minimax::MinimaxClient::list_languages()
}

#[tauri::command]
pub fn list_minimax_preset_voices(
    state: State<'_, AppArc>,
) -> Result<Vec<MinimaxPresetVoice>, String> {
    let settings = state.settings.read().map_err(err)?;
    let enabled = settings.effective_minimax_enabled_languages();
    Ok(crate::minimax::MinimaxClient::effective_preset_voices(
        &settings.minimax_synced_voices,
        &enabled,
    ))
}

#[tauri::command]
pub fn list_minimax_cloned_voices(
    state: State<'_, AppArc>,
) -> Result<Vec<MinimaxClonedVoice>, String> {
    Ok(state
        .settings
        .read()
        .map_err(err)?
        .minimax_cloned_voices
        .clone())
}

/// API is source of truth; local cache only enriches display names.
#[tauri::command]
pub fn set_minimax_cloned_voice_output_vol(
    state: State<'_, AppArc>,
    voice_id: String,
    output_vol: f32,
) -> Result<MinimaxClonedVoice, String> {
    let vid = voice_id.trim().to_string();
    if vid.is_empty() {
        return Err("voice_id is empty".into());
    }
    let clamped = output_vol.clamp(0.0, 10.0);
    let out = {
        let mut settings = state.settings.write().map_err(err)?;
        let entry = settings
            .minimax_cloned_voices
            .iter_mut()
            .find(|v| v.voice_id == vid)
            .ok_or_else(|| format!("cloned voice not found: {vid}"))?;
        entry.output_vol = Some(clamped);
        entry.clone()
    };
    state.persist_settings().map_err(err)?;
    Ok(out)
}

fn merge_minimax_cloned_voices(
    local: &[MinimaxClonedVoice],
    api: &[MinimaxClonedVoice],
) -> Vec<MinimaxClonedVoice> {
    let local_by_id: std::collections::HashMap<&str, &MinimaxClonedVoice> = local
        .iter()
        .map(|v| (v.voice_id.as_str(), v))
        .collect();
    let mut out: Vec<MinimaxClonedVoice> = api
        .iter()
        .map(|v| {
            let local_entry = local_by_id.get(v.voice_id.as_str());
            let name = local_entry
                .map(|l| l.name.as_str())
                .filter(|n| !n.trim().is_empty())
                .map(|n| n.to_string())
                .unwrap_or_else(|| v.name.clone());
            MinimaxClonedVoice {
                voice_id: v.voice_id.clone(),
                name,
                created_at: v.created_at,
                output_vol: local_entry.and_then(|l| l.output_vol).or(v.output_vol),
            }
        })
        .collect();
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out
}

fn sanitize_minimax_voice_refs(settings: &mut AppSettings, api_cloned: &[MinimaxClonedVoice]) {
    if settings.cursor_integration.provider != PROVIDER_MINIMAX {
        return;
    }
    let enabled = settings.effective_minimax_enabled_languages();
    let presets = crate::minimax::MinimaxClient::effective_preset_voices(
        &settings.minimax_synced_voices,
        &enabled,
    );
    let valid: std::collections::HashSet<String> = presets
        .into_iter()
        .map(|v| v.voice_id)
        .chain(api_cloned.iter().map(|v| v.voice_id.clone()))
        .collect();
    let voice = settings.cursor_integration.voice.trim().to_string();
    if valid.contains(&voice) {
        return;
    }
    let fallback = api_cloned
        .first()
        .map(|v| v.voice_id.clone())
        .or_else(|| {
            valid
                .iter()
                .find(|id| id.starts_with("Polish_"))
                .cloned()
        })
        .unwrap_or_else(|| crate::minimax::DEFAULT_MINIMAX_VOICE_ID.to_string());
    settings.cursor_integration.voice = fallback;
}

pub async fn sync_minimax_voices_impl(state: &AppArc) -> Result<MinimaxSyncVoicesResult, String> {
    let (presets, api_cloned, result) = state
        .minimax
        .sync_voices_from_api()
        .await
        .map_err(err)?;
    let merged_cloned = {
        let settings = state.settings.read().map_err(err)?;
        merge_minimax_cloned_voices(&settings.minimax_cloned_voices, &api_cloned)
    };
    {
        let mut settings = state.settings.write().map_err(err)?;
        settings.minimax_synced_voices = presets;
        settings.minimax_cloned_voices = merged_cloned.clone();
        settings.minimax_voices_synced_at = Some(result.synced_at);
        sanitize_minimax_voice_refs(&mut settings, &merged_cloned);
    }
    state.persist_settings().map_err(err)?;
    let settings = state.settings.read().map_err(err)?;
    let _ = cursor_integration::export_config(&settings);
    Ok(result)
}

#[tauri::command]
pub async fn sync_minimax_voices(state: State<'_, AppArc>) -> Result<MinimaxSyncVoicesResult, String> {
    sync_minimax_voices_impl(state.inner()).await
}

pub async fn minimax_clone_voice_impl(
    state: &AppArc,
    source_path: String,
    voice_id: String,
    name: String,
    model: String,
    preview_text: String,
    prompt_path: Option<String>,
    prompt_text: Option<String>,
) -> Result<MinimaxClonedVoice, String> {
    let source_bytes = std::fs::read(&source_path).map_err(err)?;
    let filename = std::path::Path::new(&source_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("clone_input.mp3");
    let file_id = state
        .minimax
        .upload_voice_file("voice_clone", filename, source_bytes)
        .await
        .map_err(err)?;

    let prompt_file_id = if let Some(pp) = prompt_path {
        let pb = std::fs::read(&pp).map_err(err)?;
        let pfn = std::path::Path::new(&pp)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("prompt.mp3");
        Some(
            state
                .minimax
                .upload_voice_file("prompt_audio", pfn, pb)
                .await
                .map_err(err)?,
        )
    } else {
        None
    };

    let model_id = crate::minimax::model_from_id(&model);
    state
        .minimax
        .clone_voice(
            file_id,
            &voice_id,
            model_id,
            &preview_text,
            prompt_file_id,
            prompt_text.as_deref(),
        )
        .await
        .map_err(err)?;

    let entry = MinimaxClonedVoice {
        voice_id: voice_id.trim().to_string(),
        name: name.trim().to_string(),
        created_at: chrono::Utc::now().timestamp(),
        output_vol: None,
    };
    {
        let mut settings = state.settings.write().map_err(err)?;
        settings
            .minimax_cloned_voices
            .retain(|v| v.voice_id != entry.voice_id);
        settings.minimax_cloned_voices.push(entry.clone());
    }
    state.persist_settings().map_err(err)?;
    if let Ok((presets, api_cloned, sync_result)) = state.minimax.sync_voices_from_api().await {
        let merged_cloned = {
            let settings = state.settings.read().map_err(err)?;
            merge_minimax_cloned_voices(&settings.minimax_cloned_voices, &api_cloned)
        };
        {
            let mut settings = state.settings.write().map_err(err)?;
            settings.minimax_synced_voices = presets;
            settings.minimax_cloned_voices = merged_cloned.clone();
            settings.minimax_voices_synced_at = Some(sync_result.synced_at);
            if merged_cloned.iter().any(|v| v.voice_id == entry.voice_id) {
                settings.cursor_integration.voice = entry.voice_id.clone();
            }
            sanitize_minimax_voice_refs(&mut settings, &merged_cloned);
        }
        state.persist_settings().map_err(err)?;
        let settings = state.settings.read().map_err(err)?;
        let _ = cursor_integration::export_config(&settings);
    }
    Ok(entry)
}

#[tauri::command]
pub async fn minimax_clone_voice(
    state: State<'_, AppArc>,
    source_path: String,
    voice_id: String,
    name: String,
    model: String,
    preview_text: String,
    prompt_path: Option<String>,
    prompt_text: Option<String>,
) -> Result<MinimaxClonedVoice, String> {
    minimax_clone_voice_impl(
        state.inner(),
        source_path,
        voice_id,
        name,
        model,
        preview_text,
        prompt_path,
        prompt_text,
    )
    .await
}

#[tauri::command]
pub fn get_session_id(state: State<'_, AppArc>) -> String {
    state.session_id.clone()
}

#[tauri::command]
pub fn get_cursor_integration_status(
    state: State<'_, AppArc>,
) -> Result<IntegrationStatus, String> {
    let mut s = cursor_integration::status().map_err(err)?;
    s.last_cursor_at = state.db.last_cursor_at().map_err(err)?;
    Ok(s)
}

#[tauri::command]
pub fn install_cursor_hooks(
    app: AppHandle,
    state: State<'_, AppArc>,
) -> Result<InstallReport, String> {
    let settings = state.settings.read().map_err(err)?.clone();
    let report = cursor_integration::install_hooks(Some(&app), &settings).map_err(err)?;
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

#[tauri::command]
pub fn list_custom_skins(
    state: State<'_, AppArc>,
) -> Result<Vec<crate::skins::SkinListEntry>, String> {
    let paths = read_paths(&state)?;
    crate::skins::list_custom_skins(&paths.skins).map_err(err)
}

#[tauri::command]
pub fn read_custom_skin(
    skin_id: String,
    state: State<'_, AppArc>,
) -> Result<crate::skins::CustomSkinLoaded, String> {
    let paths = read_paths(&state)?;
    crate::skins::read_custom_skin(&paths.skins, skin_id.trim()).map_err(err)
}

#[tauri::command]
pub fn install_skin_archive(
    archive_path: String,
    overwrite: bool,
    state: State<'_, AppArc>,
) -> Result<String, String> {
    let paths = read_paths(&state)?;
    crate::skins::install_skin_archive(
        &paths.skins,
        PathBuf::from(archive_path).as_path(),
        overwrite,
    )
    .map_err(err)
}

#[tauri::command]
pub fn export_skin(
    skin_id: String,
    dest_path: String,
    state: State<'_, AppArc>,
) -> Result<(), String> {
    let paths = read_paths(&state)?;
    crate::skins::export_skin(
        &paths.skins,
        skin_id.trim(),
        PathBuf::from(dest_path).as_path(),
    )
    .map_err(err)
}

#[tauri::command]
pub fn open_skins_folder(state: State<'_, AppArc>) -> Result<(), String> {
    let paths = read_paths(&state)?;
    open_folder(&paths.skins.to_string_lossy())
}

async fn pick_file_dialog(
    app: &AppHandle,
    title: &str,
    filters: Vec<(&str, Vec<&str>)>,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    let mut builder = app.dialog().file().set_title(title);
    for (name, exts) in filters {
        builder = builder.add_filter(name, &exts);
    }
    builder.pick_file(move |f| {
        let _ = tx.send(f.map(|p| p.to_string()));
    });
    rx.await.map_err(err)
}

async fn save_file_dialog(
    app: &AppHandle,
    title: &str,
    default_name: &str,
    filters: Vec<(&str, Vec<&str>)>,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<String>>();
    let mut builder = app
        .dialog()
        .file()
        .set_title(title)
        .set_file_name(default_name);
    for (name, exts) in filters {
        builder = builder.add_filter(name, &exts);
    }
    builder.save_file(move |f| {
        let _ = tx.send(f.map(|p| p.to_string()));
    });
    rx.await.map_err(err)
}

#[tauri::command]
pub async fn pick_skin_archive(app: AppHandle) -> Result<Option<String>, String> {
    pick_file_dialog(
        &app,
        "Importuj skórkę",
        vec![("Paczka skórki", vec!["ttskin", "zip"])],
    )
    .await
}

#[tauri::command]
pub async fn pick_skin_export_path(
    skin_id: String,
    app: AppHandle,
) -> Result<Option<String>, String> {
    let default = format!("{skin_id}.ttskin");
    save_file_dialog(
        &app,
        "Eksportuj skórkę",
        &default,
        vec![("Paczka skórki", vec!["ttskin"])],
    )
    .await
}

#[tauri::command]
pub fn get_clear_local_data_confirmation_word() -> String {
    crate::local_storage::confirmation_word()
}

#[tauri::command]
pub fn clear_local_app_data(
    confirmation: String,
    state: State<'_, AppArc>,
) -> Result<crate::local_storage::ClearLocalDataResult, String> {
    let expected = crate::local_storage::confirmation_word();
    if !crate::local_storage::confirmation_matches(&confirmation, &expected) {
        return Err(format!(
            "Nieprawidłowe potwierdzenie. Wpisz dokładnie nazwę tego komputera: {expected}"
        ));
    }
    crate::local_storage::clear_all(state.inner()).map_err(err)
}

/// Raw image bytes as standard base64 (for crop UI — avoids canvas CORS/taint from asset:// URLs).
#[tauri::command]
pub fn read_image_file_base64(path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    if !p.is_file() {
        return Err("plik obrazu nie istnieje".into());
    }
    let meta = std::fs::metadata(&p).map_err(err)?;
    if meta.len() > 20 * 1024 * 1024 {
        return Err("plik jest za duży (max 20 MB)".into());
    }
    let bytes = std::fs::read(&p).map_err(err)?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ))
}

#[tauri::command]
pub fn list_source_avatars(
    state: State<'_, AppArc>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let paths = read_paths(&state)?;
    Ok(avatars::list_source_avatars(&paths))
}

#[tauri::command]
pub fn get_source_avatar(source: String, state: State<'_, AppArc>) -> Result<AvatarInfo, String> {
    avatars::validate_source(&source).map_err(err)?;
    let paths = read_paths(&state)?;
    let path = avatars::source_avatar_path(&paths, &source);
    Ok(avatars::avatar_info(&path))
}

#[tauri::command]
pub fn get_voice_avatar(
    provider: String,
    voice_id: String,
    state: State<'_, AppArc>,
) -> Result<AvatarInfo, String> {
    avatars::validate_provider(&provider).map_err(err)?;
    let voice_id = voice_id.trim();
    if voice_id.is_empty() {
        return Err("voice_id is required".into());
    }
    let paths = read_paths(&state)?;
    let path = avatars::voice_avatar_path(&paths, &provider, voice_id);
    Ok(avatars::avatar_info(&path))
}

#[tauri::command]
pub fn save_source_avatar(
    source: String,
    image_base64: String,
    state: State<'_, AppArc>,
) -> Result<String, String> {
    avatars::validate_source(&source).map_err(err)?;
    let paths = read_paths(&state)?;
    let path = avatars::source_avatar_path(&paths, &source);
    avatars::save_avatar_jpeg(&path, &image_base64).map_err(err)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn save_voice_avatar(
    provider: String,
    voice_id: String,
    image_base64: String,
    state: State<'_, AppArc>,
) -> Result<String, String> {
    avatars::validate_provider(&provider).map_err(err)?;
    let voice_id = voice_id.trim();
    if voice_id.is_empty() {
        return Err("voice_id is required".into());
    }
    let paths = read_paths(&state)?;
    let path = avatars::voice_avatar_path(&paths, &provider, voice_id);
    avatars::save_avatar_jpeg(&path, &image_base64).map_err(err)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn delete_source_avatar(source: String, state: State<'_, AppArc>) -> Result<(), String> {
    avatars::validate_source(&source).map_err(err)?;
    let paths = read_paths(&state)?;
    let path = avatars::source_avatar_path(&paths, &source);
    avatars::delete_avatar_file(&path).map_err(err)
}

#[tauri::command]
pub fn delete_voice_avatar(
    provider: String,
    voice_id: String,
    state: State<'_, AppArc>,
) -> Result<(), String> {
    avatars::validate_provider(&provider).map_err(err)?;
    let voice_id = voice_id.trim();
    if voice_id.is_empty() {
        return Err("voice_id is required".into());
    }
    let paths = read_paths(&state)?;
    let path = avatars::voice_avatar_path(&paths, &provider, voice_id);
    avatars::delete_avatar_file(&path).map_err(err)
}

#[tauri::command]
pub async fn pick_avatar_image(app: AppHandle) -> Result<Option<String>, String> {
    pick_file_dialog(
        &app,
        "Wybierz zdjęcie awatara",
        vec![("Obrazy", vec!["jpg", "jpeg", "png", "webp"])],
    )
    .await
}

#[tauri::command]
pub fn open_avatars_folder(state: State<'_, AppArc>) -> Result<(), String> {
    let paths = read_paths(&state)?;
    std::fs::create_dir_all(&paths.avatars).map_err(err)?;
    open_folder(&paths.avatars.to_string_lossy())
}

#[tauri::command]
pub fn app_restart(app: AppHandle) {
    let _ = app.restart();
}

#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}

/// Pre-grant WebView2 microphone permission so Chromium exposes audio output device IDs.
#[tauri::command]
pub fn prepare_audio_device_enumeration(app: AppHandle) {
    crate::webview_media_permissions::grant_microphone_for_playback_webviews(&app);
}

#[tauri::command]
pub fn list_native_audio_output_devices(
) -> Result<Vec<crate::audio_output_devices::NativeAudioOutputDevice>, String> {
    crate::audio_output_devices::list_native_audio_outputs()
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

fn reload_global_shortcuts(app: &AppHandle, state: &AppArc) -> Result<(), String> {
    crate::global_shortcuts::reload_all(app, state)
}

#[tauri::command]
pub fn get_plugins(state: State<'_, AppArc>) -> Result<Vec<crate::plugins::PluginInfo>, String> {
    crate::plugins::get_plugins_list(state.inner())
}

#[tauri::command]
pub fn install_plugin(
    id: String,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Vec<crate::plugins::PluginInfo>, String> {
    let plugins = crate::plugins::install_plugin_impl(state.inner(), &id)?;
    crate::plugins::reload_after_plugin_change(&app, state.inner())?;
    Ok(plugins)
}

#[tauri::command]
pub fn uninstall_plugin(
    id: String,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Vec<crate::plugins::PluginInfo>, String> {
    let plugins = crate::plugins::uninstall_plugin_impl(state.inner(), &id)?;
    crate::plugins::reload_after_plugin_change(&app, state.inner())?;
    Ok(plugins)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPluginEnabledReq {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_plugin_enabled(
    id: String,
    req: SetPluginEnabledReq,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<Vec<crate::plugins::PluginInfo>, String> {
    let plugins = crate::plugins::set_plugin_enabled_impl(state.inner(), &id, req.enabled)?;
    crate::plugins::reload_after_plugin_change(&app, state.inner())?;
    Ok(plugins)
}

#[tauri::command]
pub fn get_soundboard(
    state: State<'_, AppArc>,
) -> Result<crate::plugins::soundboard::SoundboardPublicView, String> {
    crate::plugins::get_soundboard_public(state.inner())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSoundboardEnabledReq {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_soundboard_enabled(
    req: SetSoundboardEnabledReq,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<crate::plugins::soundboard::SoundboardPublicView, String> {
    crate::plugins::set_plugin_enabled_impl(
        state.inner(),
        crate::plugins::SOUNDBOARD_PLUGIN_ID,
        req.enabled,
    )?;
    reload_global_shortcuts(&app, state.inner())?;
    crate::plugins::get_soundboard_public(state.inner())
}

#[tauri::command]
pub fn set_soundboard_slot(
    index: usize,
    req: crate::plugins::soundboard::AssignSoundboardSlotReq,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<crate::plugins::soundboard::SoundboardPublicView, String> {
    crate::plugins::set_soundboard_slot_impl(state.inner(), index, req)?;
    reload_global_shortcuts(&app, state.inner())?;
    crate::plugins::get_soundboard_public(state.inner())
}

#[tauri::command]
pub fn update_soundboard_slot(
    index: usize,
    req: crate::plugins::soundboard::PatchSoundboardSlotReq,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<crate::plugins::soundboard::SoundboardPublicView, String> {
    crate::plugins::update_soundboard_slot_impl(state.inner(), index, req)?;
    reload_global_shortcuts(&app, state.inner())?;
    crate::plugins::get_soundboard_public(state.inner())
}

#[tauri::command]
pub fn clear_soundboard_slot(
    index: usize,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<crate::plugins::soundboard::SoundboardPublicView, String> {
    crate::plugins::clear_soundboard_slot_impl(state.inner(), index)?;
    reload_global_shortcuts(&app, state.inner())?;
    crate::plugins::get_soundboard_public(state.inner())
}

#[tauri::command]
pub fn play_soundboard_slot(
    index: usize,
    state: State<'_, AppArc>,
    app: AppHandle,
) -> Result<(), String> {
    crate::plugins::play_soundboard_slot_impl(&app, state.inner(), index)
}
