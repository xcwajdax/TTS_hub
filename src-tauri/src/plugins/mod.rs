pub mod lifecycle;
pub mod registry;
pub mod soundboard;
pub mod state;

pub use registry::PluginInfo;
pub use lifecycle::{
    get_plugins_list, install_plugin_impl, reload_after_plugin_change, set_plugin_enabled_impl,
    uninstall_plugin_impl,
};
pub use state::{soundboard_plugin_active, SOUNDBOARD_PLUGIN_ID};
pub use soundboard::{
    clear_soundboard_slot_impl, get_soundboard_public, play_soundboard_slot_impl,
    set_soundboard_slot_impl, update_soundboard_slot_impl,
};
