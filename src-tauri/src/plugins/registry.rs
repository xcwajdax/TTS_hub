use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub icon: String,
    pub price: String,
    pub builtin: bool,
    pub installed: bool,
    pub enabled: bool,
}

const BUILTIN: &[(&str, &str, &str, &str)] = &[
    (
        "soundboard",
        "Soundboard",
        "Osiem slotów z dźwiękami z historii lub dysku. Panel historii: zakładka i pasek u dołu. Skróty Ctrl+Shift+1–8.",
        "grid",
    ),
];

pub fn list_plugins(plugins: &crate::plugins::state::PluginsState) -> Vec<PluginInfo> {
    BUILTIN
        .iter()
        .map(|(id, name, description, icon)| {
            let installed = plugins.is_installed(id);
            let enabled = plugins.is_enabled(id);
            PluginInfo {
                id: id.to_string(),
                name: name.to_string(),
                description: description.to_string(),
                version: "1.0.0".to_string(),
                icon: icon.to_string(),
                price: "free".to_string(),
                builtin: true,
                installed,
                enabled,
            }
        })
        .collect()
}

pub fn is_known_plugin(id: &str) -> bool {
    BUILTIN.iter().any(|(pid, ..)| *pid == id)
}
