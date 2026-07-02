use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::fast_work::state::FastWorkArc;
use crate::selection_capture;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn reload_shortcut(app: &AppHandle, state: &FastWorkArc) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all()
        .map_err(|e| format!("unregister shortcut: {e}"))?;

    let shortcut = {
        let cfg = state.config.read().map_err(|e| format!("{e}"))?;
        cfg.shortcut.clone().filter(|s| !s.is_empty())
    };

    let Some(shortcut) = shortcut else {
        return Ok(());
    };

    selection_capture::ensure_foreground_tracker(app.clone());
    let state_for_handler = state.clone();
    let app_for_handler = app.clone();

    gs.on_shortcut(shortcut.as_str(), move |app, _shortcut, event| {
        if event.state != ShortcutState::Pressed {
            return;
        }
        let Some(st) = app.try_state::<FastWorkArc>() else {
            return;
        };
        let app = app.clone();
        let st = st.inner().clone();
        tauri::async_runtime::spawn(async move {
            match run_hotkey_generate(&app, &st).await {
                Ok(gen) => {
                    let _ = app.emit("fast-work:generated", &gen);
                }
                Err(message) => {
                    let _ = app.emit("fast-work:error", message);
                }
            }
        });
    })
    .map_err(|e| format!("register {shortcut}: {e}"))?;

    let _ = app_for_handler;
    let _ = state_for_handler;
    Ok(())
}

async fn run_hotkey_generate(app: &AppHandle, state: &FastWorkArc) -> Result<crate::fast_work::config::FastWorkGeneration, String> {
    let text = selection_capture::capture_selection_text(app)?;
    super::commands::generate_text(state, text).await
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn reload_shortcut(_app: &AppHandle, _state: &FastWorkArc) -> Result<(), String> {
    Ok(())
}
