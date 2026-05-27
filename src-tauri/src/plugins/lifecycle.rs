use std::sync::Arc;

use tauri::AppHandle;

use crate::plugins::registry::{is_known_plugin, list_plugins};
use crate::plugins::state::SOUNDBOARD_PLUGIN_ID;
use crate::plugins::PluginInfo;
use crate::state::AppState;

type AppArc = Arc<AppState>;

pub fn get_plugins_list(state: &AppArc) -> Result<Vec<PluginInfo>, String> {
    let ps = state.plugins_state.read().map_err(|e| format!("{e}"))?;
    Ok(list_plugins(&ps))
}

pub fn install_plugin_impl(state: &AppArc, id: &str) -> Result<Vec<PluginInfo>, String> {
    if !is_known_plugin(id) {
        return Err(format!("Nieznane rozszerzenie: {id}"));
    }
    let mut ps = state.plugins_state.write().map_err(|e| format!("{e}"))?;
    ps.install(id);
    state
        .persist_plugins_state(&ps)
        .map_err(|e| format!("{e}"))?;
    Ok(list_plugins(&ps))
}

pub fn uninstall_plugin_impl(state: &AppArc, id: &str) -> Result<Vec<PluginInfo>, String> {
    if !is_known_plugin(id) {
        return Err(format!("Nieznane rozszerzenie: {id}"));
    }
    let mut ps = state.plugins_state.write().map_err(|e| format!("{e}"))?;
    ps.uninstall(id);
    if id == SOUNDBOARD_PLUGIN_ID {
        let mut sb = state.soundboard.write().map_err(|e| format!("{e}"))?;
        sb.enabled = false;
        state
            .persist_soundboard(&sb)
            .map_err(|e| format!("{e}"))?;
    }
    state
        .persist_plugins_state(&ps)
        .map_err(|e| format!("{e}"))?;
    Ok(list_plugins(&ps))
}

pub fn set_plugin_enabled_impl(
    state: &AppArc,
    id: &str,
    enabled: bool,
) -> Result<Vec<PluginInfo>, String> {
    if !is_known_plugin(id) {
        return Err(format!("Nieznane rozszerzenie: {id}"));
    }
    let mut ps = state.plugins_state.write().map_err(|e| format!("{e}"))?;
    if !ps.is_installed(id) {
        return Err("Rozszerzenie nie jest zainstalowane.".into());
    }
    ps.set_enabled(id, enabled);
    if id == SOUNDBOARD_PLUGIN_ID {
        let mut sb = state.soundboard.write().map_err(|e| format!("{e}"))?;
        sb.enabled = enabled;
        sb.normalize();
        state
            .persist_soundboard(&sb)
            .map_err(|e| format!("{e}"))?;
    }
    state
        .persist_plugins_state(&ps)
        .map_err(|e| format!("{e}"))?;
    Ok(list_plugins(&ps))
}

pub fn reload_after_plugin_change(app: &AppHandle, state: &AppArc) -> Result<(), String> {
    crate::global_shortcuts::reload_all(app, state)
}
