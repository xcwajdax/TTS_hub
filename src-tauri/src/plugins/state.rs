use std::collections::HashSet;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::paths::AppPaths;
use crate::plugins::soundboard::SoundboardSettings;

pub const SOUNDBOARD_PLUGIN_ID: &str = "soundboard";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginsState {
    #[serde(default)]
    pub installed: Vec<String>,
    #[serde(default)]
    pub enabled: Vec<String>,
}

impl PluginsState {
    pub fn path(paths: &AppPaths) -> PathBuf {
        paths.plugins.join("installed.json")
    }

    pub fn load(path: &Path, soundboard: &SoundboardSettings) -> Result<Self> {
        let mut state = if path.is_file() {
            let raw = std::fs::read_to_string(path).context("read plugins installed.json")?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            Self::default()
        };
        state.normalize();
        state.migrate_legacy_soundboard(soundboard);
        Ok(state)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).context("serialize plugins state")?;
        std::fs::write(path, json).context("write plugins installed.json")?;
        Ok(())
    }

    fn normalize(&mut self) {
        let installed: HashSet<_> = self.installed.drain(..).collect();
        self.installed = installed.into_iter().collect();
        let enabled: HashSet<_> = self
            .enabled
            .drain(..)
            .filter(|id| self.installed.contains(id))
            .collect();
        self.enabled = enabled.into_iter().collect();
    }

    /// Users who already configured soundboard before install flow existed.
    fn migrate_legacy_soundboard(&mut self, soundboard: &SoundboardSettings) {
        if self.is_installed(SOUNDBOARD_PLUGIN_ID) {
            return;
        }
        let has_content = soundboard.slots.iter().any(|s| !s.audio.is_empty());
        if has_content || soundboard.enabled {
            self.installed.push(SOUNDBOARD_PLUGIN_ID.to_string());
            if soundboard.enabled {
                self.enabled.push(SOUNDBOARD_PLUGIN_ID.to_string());
            }
        }
    }

    pub fn is_installed(&self, id: &str) -> bool {
        self.installed.iter().any(|x| x == id)
    }

    pub fn is_enabled(&self, id: &str) -> bool {
        self.is_installed(id) && self.enabled.iter().any(|x| x == id)
    }

    pub fn install(&mut self, id: &str) {
        if !self.is_installed(id) {
            self.installed.push(id.to_string());
        }
    }

    pub fn uninstall(&mut self, id: &str) {
        self.installed.retain(|x| x != id);
        self.enabled.retain(|x| x != id);
    }

    pub fn set_enabled(&mut self, id: &str, enabled: bool) {
        if !self.is_installed(id) {
            return;
        }
        if enabled {
            if !self.is_enabled(id) {
                self.enabled.push(id.to_string());
            }
        } else {
            self.enabled.retain(|x| x != id);
        }
    }
}

pub fn soundboard_plugin_active(state: &PluginsState, soundboard: &SoundboardSettings) -> bool {
    state.is_enabled(SOUNDBOARD_PLUGIN_ID) && soundboard.enabled
}
