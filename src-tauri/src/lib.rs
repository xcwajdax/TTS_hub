mod app_settings;
mod audio;
mod commands;
mod config;
mod cursor_integration;
mod db;
mod google;
mod http_api;
mod paths;
mod state;
mod voice_samples;

use std::sync::Arc;

pub fn run() {
    let app_state = match state::AppState::initialize() {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("FATAL: failed to initialize app state: {e:#}");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            commands::generate,
            commands::list_history,
            commands::update_generation_title,
            commands::archive_generation,
            commands::delete_generation,
            commands::reveal_in_explorer,
            commands::open_archive_folder,
            commands::pick_archive_folder,
            commands::pick_archive_folder_save,
            commands::pick_temp_folder,
            commands::get_app_settings,
            commands::set_app_settings,
            commands::list_voices,
            commands::list_models,
            commands::list_voice_samples,
            commands::ensure_voice_sample,
            commands::generate_all_voice_samples,
            commands::get_session_id,
            commands::get_cursor_integration_status,
            commands::install_cursor_hooks,
            commands::uninstall_cursor_hooks,
            commands::export_cursor_hook_config,
            commands::set_cursor_integration,
            commands::set_cursor_dnd,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let http_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = http_api::serve(http_state, handle).await {
                    eprintln!("HTTP API server error: {e:#}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
