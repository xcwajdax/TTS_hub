mod app_settings;
mod avatars;
mod audio;
mod commands;
mod config;
mod cursor_integration;
mod editor_quick_gen;
mod db;
mod google;
mod http_api;
mod job_queue;
mod menu;
mod paths;
mod quick_hotkeys;
mod quick_setup_window;
mod selection_capture;
mod skins;
mod playback_toast_window;
mod toast_window;
mod state;
mod text_filters;
mod voice_samples;
mod minimax;
mod voicebox;
mod local_storage;

use std::sync::Arc;

pub fn run() {
    let app_state = match state::AppState::initialize() {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("FATAL: failed to initialize app state: {e:#}");
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
            commands::generate,
            commands::get_token_usage,
            commands::list_history,
            commands::list_folders,
            commands::list_tags,
            commands::create_tag,
            commands::rename_tag,
            commands::delete_tag,
            commands::set_generation_tags,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::move_to_folder,
            commands::list_folder_rules,
            commands::upsert_folder_rule,
            commands::delete_folder_rule,
            commands::list_jobs,
            commands::cancel_job,
            commands::resume_job,
            commands::discard_job,
            commands::resume_all_interrupted,
            commands::discard_all_interrupted,
            commands::update_generation_title,
            commands::update_generation_ui_color,
            commands::archive_generation,
            commands::delete_generation,
            commands::read_text_file,
            commands::export_generation_to_path,
            commands::copy_generation_audio_to_clipboard,
            commands::reveal_in_explorer,
            commands::open_archive_folder,
            commands::pick_archive_folder,
            commands::pick_archive_folder_save,
            commands::pick_temp_folder,
            commands::get_app_settings,
            commands::set_app_settings,
            commands::probe_google,
            commands::probe_voicebox,
            commands::probe_minimax,
            commands::open_quick_setup_window,
            commands::close_quick_setup_window,
            commands::test_quick_hotkey_preset,
            commands::hide_quick_hotkey_toast,
            commands::show_playback_toast,
            commands::hide_playback_toast,
            commands::list_voices,
            commands::list_models,
            commands::voicebox_health,
            commands::list_voicebox_profiles,
            commands::list_voicebox_models,
            commands::minimax_health,
            commands::list_minimax_models,
            commands::list_minimax_languages,
            commands::list_minimax_preset_voices,
            commands::list_minimax_cloned_voices,
            commands::sync_minimax_voices,
            commands::minimax_clone_voice,
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
            commands::list_custom_skins,
            commands::read_custom_skin,
            commands::install_skin_archive,
            commands::export_skin,
            commands::open_skins_folder,
            commands::pick_skin_archive,
            commands::pick_skin_export_path,
            commands::get_clear_local_data_confirmation_word,
            commands::clear_local_app_data,
            commands::app_restart,
            commands::app_exit,
            commands::read_image_file_base64,
            commands::list_source_avatars,
            commands::get_source_avatar,
            commands::get_voice_avatar,
            commands::save_source_avatar,
            commands::save_voice_avatar,
            commands::delete_source_avatar,
            commands::delete_voice_avatar,
            commands::pick_avatar_image,
            commands::open_avatars_folder,
        ])
        .on_menu_event(|app, event| menu::handle_event(app, event))
        .setup(move |app| {
            menu::attach(app)?;
            let handle = app.handle().clone();
            let max_concurrent = app_state
                .settings
                .read()
                .map(|s| s.max_concurrent_jobs)
                .unwrap_or(3);
            let queue =
                job_queue::JobQueue::start(app_state.clone(), handle.clone(), max_concurrent);
            let _ = app_state.job_queue.set(queue);
            let http_state = app_state.clone();
            let http_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = http_api::serve(http_state, http_handle).await {
                    eprintln!("HTTP API server error: {e:#}");
                }
            });
            selection_capture::ensure_foreground_tracker(handle.clone());
            if let Err(e) = quick_hotkeys::reload_from_settings(&handle, &app_state) {
                eprintln!("quick hotkeys registration: {e:#}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
