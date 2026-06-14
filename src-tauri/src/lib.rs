mod app_settings;
mod global_shortcuts;
mod plugins;
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
mod minimax_options;
mod voice_pack;
mod voice_profiles;
mod voicebox;
mod voicebox_server;
mod roleplay;
mod chat;
mod local_storage;
mod audio_output_devices;
mod webview_media_permissions;
mod usage;
mod minimax_subtitles;
mod video_export;

use std::sync::Arc;

use tauri::Manager;
use tauri::Emitter;

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
            commands::list_generations_for_origin,
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
            commands::set_safe_mode,
            commands::approve_generations,
            commands::reject_generations,
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
            commands::write_text_file,
            commands::export_generation_to_path,
            commands::export_generation_mp4_to_path,
            commands::copy_generation_mp4_to_clipboard,
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
            commands::voicebox_server_status,
            commands::list_voicebox_profiles,
            commands::list_voicebox_models,
            commands::voicebox_get_profile,
            commands::voicebox_create_profile,
            commands::voicebox_update_profile,
            commands::voicebox_delete_profile,
            commands::voicebox_list_profile_samples,
            commands::voicebox_add_profile_sample,
            commands::voicebox_delete_profile_sample,
            commands::voicebox_fetch_sample_audio,
            commands::voicebox_list_history,
            commands::voicebox_get_history_item,
            commands::voicebox_delete_history_item,
            commands::voicebox_fetch_history_audio,
            commands::sync_voicebox_profile_avatar,
            commands::sync_voicebox_profile_avatars,
            commands::minimax_health,
            commands::list_minimax_models,
            commands::list_minimax_languages,
            commands::list_minimax_preset_voices,
            commands::list_minimax_cloned_voices,
            commands::set_minimax_cloned_voice_output_vol,
            commands::sync_minimax_voices,
            commands::minimax_clone_voice,
            commands::minimax_design_voice,
            commands::minimax_delete_voice,
            commands::minimax_upload_text_file,
            commands::list_voice_samples,
            commands::ensure_voice_sample,
            commands::generate_all_voice_samples,
            commands::get_session_id,
            commands::get_cursor_integration_status,
            commands::get_app_build_info,
            commands::get_mcp_integration_status,
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
            commands::export_voice_profile_pack,
            commands::import_voice_profile_pack,
            commands::pick_voice_pack_archive,
            commands::pick_voice_pack_export_path,
            commands::import_voice_profile_pack_from_url,
            commands::get_clear_local_data_confirmation_word,
            commands::get_local_storage_stats,
            commands::clear_local_app_data,
            commands::app_restart,
            commands::app_exit,
            commands::prepare_audio_device_enumeration,
            commands::list_native_audio_output_devices,
            commands::read_image_file_base64,
            commands::list_source_avatars,
            commands::get_source_avatar,
            commands::list_origin_avatars,
            commands::get_origin_avatar,
            commands::save_origin_avatar,
            commands::get_voice_avatar,
            commands::save_source_avatar,
            commands::save_voice_avatar,
            commands::delete_source_avatar,
            commands::delete_voice_avatar,
            commands::pick_avatar_image,
            commands::open_avatars_folder,
            commands::get_plugins,
            commands::install_plugin,
            commands::uninstall_plugin,
            commands::set_plugin_enabled,
            commands::get_soundboard,
            commands::set_soundboard_enabled,
            commands::set_soundboard_slot,
            commands::update_soundboard_slot,
            commands::clear_soundboard_slot,
            commands::play_soundboard_slot,
            // === local per-provider usage counter (2026-06-07) ===
            commands::get_provider_usage,
            commands::get_all_usage,
            roleplay::commands::roleplay_list_projects,
            roleplay::commands::roleplay_create_project,
            roleplay::commands::roleplay_load_project,
            roleplay::commands::roleplay_save_project,
            roleplay::commands::roleplay_delete_project,
            roleplay::commands::roleplay_update_timeline,
            roleplay::commands::roleplay_start_queue,
            roleplay::commands::roleplay_pause_queue,
            roleplay::commands::roleplay_resume_queue,
            roleplay::commands::roleplay_cancel_queue,
            roleplay::commands::roleplay_get_queue_progress,
            roleplay::commands::roleplay_regenerate_segment,
            roleplay::commands::roleplay_import_audio,
            roleplay::commands::roleplay_write_mix_wav,
            roleplay::commands::roleplay_export_mix,
            chat::commands::chat_create_session,
            chat::commands::chat_list_sessions,
            chat::commands::chat_get_session,
            chat::commands::chat_update_session,
            chat::commands::chat_delete_session,
            chat::commands::chat_list_messages,
            chat::commands::chat_add_message,
            chat::commands::chat_replay_message,
            chat::commands::chat_list_recent_sources,
        ])
        .on_menu_event(|app, event| menu::handle_event(app, event))
        .setup(move |app| {
            menu::attach(app)?;
            let handle = app.handle().clone();
            let _ = app_state.app_handle.set(handle.clone());
            let max_concurrent = app_state
                .settings
                .read()
                .map(|s| s.max_concurrent_jobs)
                .unwrap_or(3);
            let queue =
                job_queue::JobQueue::start(app_state.clone(), handle.clone(), max_concurrent);
            let _ = app_state.job_queue.set(queue);
            let roleplay_q = roleplay::queue::RoleplayQueue::start(handle.clone());
            let _ = app_state.roleplay_queue.set(roleplay_q);
            let http_state = app_state.clone();
            let http_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = http_api::serve(http_state, http_handle).await {
                    eprintln!("HTTP API server error: {e:#}");
                }
            });
            if let Some(import_url) = voice_pack::startup_import_url_from_args() {
                let import_state = app_state.clone();
                let import_handle = handle.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(900)).await;
                    match voice_pack::import_and_persist_profile_from_url(&import_state, &import_url).await
                    {
                        Ok(profile) => {
                            let _ = import_handle.emit("voice-pack:imported", &profile);
                        }
                        Err(e) => eprintln!("startup voice pack import failed: {e:#}"),
                    }
                });
            }
            // === chat-window: cleanup unsaved sessions older than 7 days on startup ===
            // (Hourly cron is overkill for first version; cleanup-at-start covers
            // the "user closed app and came back" case which is the main scenario.)
            {
                let conn = app_state.db.conn();
                let max_age_ms = 7 * 24 * 3600 * 1000_i64;
                match chat::db::cleanup_unsaved_older_than(&conn, max_age_ms) {
                    Ok(n) if n > 0 => log::info!("chat cleanup on startup: deleted {n} unsaved sessions"),
                    Ok(_) => {}
                    Err(e) => log::warn!("chat cleanup on startup error: {e:#}"),
                }
            }
            selection_capture::ensure_foreground_tracker(handle.clone());
            if let Err(e) = global_shortcuts::reload_all(&handle, &app_state) {
                eprintln!("global shortcuts registration: {e:#}");
            }
            webview_media_permissions::grant_microphone_for_playback_webviews(&handle);
            if let Some(main) = handle.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
                let script = r#"
                  (() => {
                    if (window.__ttsHubAudioUnlockStarted) return;
                    window.__ttsHubAudioUnlockStarted = true;
                    (async () => {
                      try {
                        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                        s.getTracks().forEach((t) => t.stop());
                        window.dispatchEvent(new Event("tts-hub-audio-unlock"));
                      } catch (e) {
                        console.warn("[tts-hub] audio unlock:", e);
                      }
                    })();
                  })();
                "#;
                let _ = main.eval(script);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
