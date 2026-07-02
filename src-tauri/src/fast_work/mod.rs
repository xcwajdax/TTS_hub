mod commands;
pub mod config;
mod shortcuts;
mod state;

use std::sync::Arc;

use tauri::Manager;

use crate::fast_work::state::{FastWorkArc, FastWorkState};

pub fn run(context: tauri::Context) {
    let app_state = match FastWorkState::initialize() {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("FATAL: Fast Work init failed: {e:#}");
            std::process::exit(1);
        }
    };

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            commands::fast_work_generate,
            commands::fast_work_list_session_history,
            commands::fast_work_get_settings,
            commands::fast_work_set_shortcut,
            commands::fast_work_pick_output_folder,
            commands::fast_work_new_output_folder,
            commands::fast_work_open_output_folder,
            commands::fast_work_reveal_file,
            commands::fast_work_get_session_id,
            commands::fast_work_probe_minimax,
            commands::fast_work_app_exit,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let _ = app_state.app_handle.set(handle.clone());
            if let Err(e) = shortcuts::reload_shortcut(&handle, &app_state) {
                eprintln!("fast-work shortcut: {e:#}");
            }
            if let Some(win) = handle.get_webview_window("fast-work") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .build(context)
        .expect("error while building Fast Work application")
        .run(|_app, _event| {});
}
