use std::collections::HashSet;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};

use crate::plugins::soundboard::{self, SoundboardSettings};
use crate::quick_hotkeys::{self, QuickHotkeysSettings};
use crate::state::AppState;

type AppArc = Arc<AppState>;

#[derive(Clone)]
enum HotkeyTarget {
    QuickTts(String),
    Soundboard(usize),
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn reload_all(app: &AppHandle, state: &AppArc) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let gs = app.global_shortcut();
    gs.unregister_all()
        .map_err(|e| format!("unregister shortcuts: {e}"))?;

    let settings = state.settings.read().map_err(|e| format!("{e}"))?;
    let plugins = state.plugins_state.read().map_err(|e| format!("{e}"))?;
    let mut soundboard = state.soundboard.write().map_err(|e| format!("{e}"))?;
    let soundboard_active =
        crate::plugins::soundboard_plugin_active(&plugins, &soundboard);

    let bindings = collect_bindings(&settings.quick_hotkeys, &mut soundboard, soundboard_active);
    state
        .persist_soundboard(&soundboard)
        .map_err(|e| format!("{e}"))?;
    drop(soundboard);

    if bindings.is_empty() {
        return Ok(());
    }

    crate::selection_capture::ensure_foreground_tracker(app.clone());

    for (shortcut, target) in bindings {
        gs.on_shortcut(shortcut.as_str(), move |app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            let Some(state) = app.try_state::<AppArc>() else {
                return;
            };
            match &target {
                HotkeyTarget::QuickTts(preset_id) => {
                    if let Err(message) = quick_hotkeys::run_preset(app, &state, preset_id) {
                        let _ = app.emit(
                            "quick-hotkey:error",
                            quick_hotkeys::QuickHotkeyErrorEvent {
                                message,
                                preset_id: preset_id.clone(),
                            },
                        );
                    }
                }
                HotkeyTarget::Soundboard(index) => {
                    if let Err(message) = soundboard::play_soundboard_slot_impl(app, &state, *index)
                    {
                        let _ = app.emit(
                            "soundboard:error",
                            soundboard::SoundboardErrorEvent {
                                message,
                                slot_index: *index,
                            },
                        );
                    }
                }
            }
        })
        .map_err(|e| format!("register {}: {e}", shortcut))?;
    }

    Ok(())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn reload_all(_app: &AppHandle, _state: &AppArc) -> Result<(), String> {
    Ok(())
}

fn collect_bindings(
    quick: &QuickHotkeysSettings,
    soundboard: &mut SoundboardSettings,
    soundboard_active: bool,
) -> Vec<(String, HotkeyTarget)> {
    soundboard.clear_conflict_flags();

    let mut seen = HashSet::new();
    let mut out = Vec::new();

    if quick.enabled {
        for preset in quick.presets.iter().filter(|p| p.enabled) {
            let key = preset.shortcut.to_lowercase();
            if key.is_empty() || !seen.insert(key.clone()) {
                continue;
            }
            out.push((preset.shortcut.clone(), HotkeyTarget::QuickTts(preset.id.clone())));
        }
    }

    if soundboard_active {
        for (index, slot) in soundboard.slots.iter_mut().enumerate() {
            if !slot.enabled || slot.audio.is_empty() {
                slot.shortcut_conflict = false;
                continue;
            }
            let key = slot.shortcut.to_lowercase();
            if key.is_empty() {
                slot.shortcut_conflict = false;
                continue;
            }
            if !seen.insert(key.clone()) {
                slot.shortcut_conflict = true;
                continue;
            }
            slot.shortcut_conflict = false;
            out.push((slot.shortcut.clone(), HotkeyTarget::Soundboard(index)));
        }
    }

    out
}
