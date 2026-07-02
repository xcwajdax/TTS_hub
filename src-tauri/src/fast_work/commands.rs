use std::path::PathBuf;

use serde::Deserialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::audio::{write_downloaded_audio, AudioFormat};
use crate::commands::derive_title;
use crate::fast_work::config::{FastWorkGeneration, FastWorkSettingsView};
use crate::fast_work::shortcuts;
use crate::fast_work::state::FastWorkArc;
use crate::minimax::{model_from_id, resolve_minimax_options, MinimaxGenerateParams, DEFAULT_MINIMAX_LANGUAGE};
use crate::portable_paths::timestamp_folder_name;

fn err(e: impl std::fmt::Display) -> String {
    format!("{e}")
}

#[derive(Debug, Deserialize)]
pub struct FastWorkGenerateReq {
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct FastWorkShortcutUpdate {
    pub shortcut: Option<String>,
}

pub async fn generate_text(
    state: &FastWorkArc,
    text: String,
) -> Result<FastWorkGeneration, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Tekst jest pusty.".into());
    }

    {
        let mut busy = state.generating.write().map_err(err)?;
        if *busy {
            return Err("Trwa inna generacja — poczekaj.".into());
        }
        *busy = true;
    }

    let result = generate_text_inner(state, trimmed.to_string()).await;
    {
        let mut busy = state.generating.write().map_err(err)?;
        *busy = false;
    }
    result
}

async fn generate_text_inner(
    state: &FastWorkArc,
    text: String,
) -> Result<FastWorkGeneration, String> {
    let (profile, save_format, _api_key) = {
        let cfg = state.config.read().map_err(err)?;
        (cfg.profile.clone(), cfg.save_format.clone(), cfg.minimax_api_key.clone())
    };

    let id = uuid::Uuid::new_v4().to_string();
    let now_ms = chrono::Utc::now().timestamp_millis();
    let title = derive_title(&text);
    let stem = state.next_file_stem();
    let file_stem = format!("{stem}-{}", slugify_for_filename(&title));

    let pending = FastWorkGeneration {
        id: id.clone(),
        created_at: now_ms,
        title: title.clone(),
        text: text.clone(),
        file_path: String::new(),
        format: save_format.clone(),
        duration_ms: None,
        status: "running".to_string(),
        error: None,
    };

    {
        let mut hist = state.session_history.write().map_err(err)?;
        hist.insert(0, pending.clone());
    }

    let voice_id = profile.voice.trim().to_string();
    if voice_id.is_empty() {
        return fail_generation(state, &id, "Brak voice_id w profilu MiniMax.");
    }

    let model = model_from_id(&profile.model).to_string();
    let minimax_options = resolve_minimax_options(
        profile.minimax_options.clone(),
        None,
        profile.minimax_speed,
        profile.minimax_vol,
        profile.minimax_pitch,
        profile.language.as_deref().or(Some(DEFAULT_MINIMAX_LANGUAGE)),
    );

    let fmt = AudioFormat::from_str(&save_format).ok_or_else(|| "Nieznany format audio.".to_string())?;

    let audio = match state
        .minimax
        .generate_audio(MinimaxGenerateParams {
            model: &model,
            text: &text,
            voice_id: &voice_id,
            hub_format: &save_format,
            options: &minimax_options,
        })
        .await
    {
        Ok(a) => a,
        Err(e) => return fail_generation(state, &id, &e.to_string()),
    };

    let output_dir = state.output_dir.read().map_err(err)?.clone();
    let source_fmt = AudioFormat::from_str(&audio.format).unwrap_or(AudioFormat::Mp3);
    let written = match write_downloaded_audio(&audio.bytes, source_fmt, &output_dir, &file_stem, fmt) {
        Ok(w) => w,
        Err(e) => return fail_generation(state, &id, &e.to_string()),
    };

    let file_path = written.path.to_string_lossy().to_string();
    let done = FastWorkGeneration {
        id,
        created_at: now_ms,
        title,
        text,
        file_path,
        format: written.format.ext().to_string(),
        duration_ms: None,
        status: "done".to_string(),
        error: None,
    };

    {
        let mut hist = state.session_history.write().map_err(err)?;
        if let Some(row) = hist.iter_mut().find(|g| g.id == done.id) {
            *row = done.clone();
        }
    }

    Ok(done)
}

fn fail_generation(state: &FastWorkArc, id: &str, message: &str) -> Result<FastWorkGeneration, String> {
    {
        let mut hist = state.session_history.write().map_err(err)?;
        if let Some(row) = hist.iter_mut().find(|g| g.id == id) {
            row.status = "failed".to_string();
            row.error = Some(message.to_string());
            return Ok(row.clone());
        }
    }
    Err(message.to_string())
}

fn slugify_for_filename(title: &str) -> String {
    let mut out = String::new();
    for c in title.chars().take(40) {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if c.is_whitespace() || c == '-' || c == '_' {
            if !out.ends_with('-') && !out.is_empty() {
                out.push('-');
            }
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        "tts".to_string()
    } else {
        out
    }
}

#[tauri::command]
pub async fn fast_work_generate(
    req: FastWorkGenerateReq,
    state: State<'_, FastWorkArc>,
) -> Result<FastWorkGeneration, String> {
    generate_text(&state, req.text).await
}

#[tauri::command]
pub fn fast_work_list_session_history(state: State<'_, FastWorkArc>) -> Vec<FastWorkGeneration> {
    state
        .session_history
        .read()
        .map(|h| h.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn fast_work_get_settings(state: State<'_, FastWorkArc>) -> Result<FastWorkSettingsView, String> {
    let cfg = state.config.read().map_err(err)?;
    let output_dir = state.output_dir.read().map_err(err)?;
    Ok(FastWorkSettingsView {
        profile_name: cfg.profile.name.clone(),
        source_profile_name: cfg.source_profile_name.clone(),
        save_format: cfg.save_format.clone(),
        shortcut: cfg.shortcut.clone(),
        output_dir: output_dir.to_string_lossy().to_string(),
        exported_at: cfg.exported_at,
    })
}

#[tauri::command]
pub fn fast_work_set_shortcut(
    update: FastWorkShortcutUpdate,
    app: AppHandle,
    state: State<'_, FastWorkArc>,
) -> Result<FastWorkSettingsView, String> {
    {
        let mut cfg = state.config.write().map_err(err)?;
        cfg.shortcut = update
            .shortcut
            .map(|s| crate::quick_hotkeys::normalize_shortcut_string(&s))
            .filter(|s| !s.is_empty());
        cfg.normalize();
        cfg.save(&state.paths.config_file).map_err(err)?;
    }
    shortcuts::reload_shortcut(&app, &state)?;
    fast_work_get_settings(state)
}

#[tauri::command]
pub async fn fast_work_pick_output_folder(
    app: AppHandle,
    state: State<'_, FastWorkArc>,
) -> Result<Option<String>, String> {
    let picked = pick_folder_dialog(&app).await?;
    if let Some(path) = picked {
        let pb = PathBuf::from(&path);
        state.paths.ensure_output_dir(&pb).map_err(err)?;
        {
            let mut out = state.output_dir.write().map_err(err)?;
            *out = pb;
        }
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn fast_work_new_output_folder(state: State<'_, FastWorkArc>) -> Result<String, String> {
    let parent = {
        let current = state.output_dir.read().map_err(err)?;
        current
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| state.paths.output_root.clone())
    };
    let dir = parent.join(timestamp_folder_name());
    state.paths.ensure_output_dir(&dir).map_err(err)?;
    {
        let mut out = state.output_dir.write().map_err(err)?;
        *out = dir.clone();
    }
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn fast_work_open_output_folder(state: State<'_, FastWorkArc>) -> Result<(), String> {
    let dir = state.output_dir.read().map_err(err)?.clone();
    open_in_explorer(&dir)
}

#[tauri::command]
pub fn fast_work_reveal_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    open_in_explorer(p.as_path())
}

#[tauri::command]
pub fn fast_work_get_session_id(state: State<'_, FastWorkArc>) -> String {
    state.session_id.clone()
}

#[tauri::command]
pub async fn fast_work_probe_minimax(
    state: State<'_, FastWorkArc>,
) -> Result<crate::minimax::MinimaxHealth, String> {
    Ok(state.minimax.health().await)
}

#[tauri::command]
pub fn fast_work_app_exit(app: AppHandle) {
    app.exit(0);
}

async fn pick_folder_dialog(app: &AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Wybierz folder zapisu")
        .pick_folder(move |f| {
            let _ = tx.send(f.map(|p| p.to_string()));
        });
    rx.await
        .map_err(|_| "dialog cancelled".to_string())
}

fn open_in_explorer(path: &std::path::Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Ścieżka nie istnieje: {}", path.display()));
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(if path.is_dir() {
                path.to_string_lossy().to_string()
            } else {
                format!("/select,{}", path.display())
            })
            .spawn()
            .map_err(|e| format!("explorer: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(if path.is_file() {
                "-R"
            } else {
                ""
            })
            .arg(path)
            .spawn()
            .map_err(|e| format!("open: {e}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let target = if path.is_file() {
            path.parent().unwrap_or(path)
        } else {
            path
        };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("xdg-open: {e}"))?;
    }
    Ok(())
}
