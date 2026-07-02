use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::voice_profiles::TtsVoiceProfile;

pub const CONFIG_FILE: &str = "fast-work.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FastWorkConfig {
    pub profile: TtsVoiceProfile,
    pub minimax_api_key: String,
    #[serde(default = "default_save_format")]
    pub save_format: String,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub exported_at: i64,
    #[serde(default)]
    pub source_profile_name: String,
}

fn default_save_format() -> String {
    "wav".to_string()
}

impl FastWorkConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let raw = std::fs::read_to_string(path)
            .with_context(|| format!("cannot read {}", path.display()))?;
        let mut cfg: Self = serde_json::from_str(&raw).context("invalid fast-work.json")?;
        cfg.normalize();
        Ok(cfg)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).context("serialize fast-work.json")?;
        std::fs::write(path, json).with_context(|| format!("cannot write {}", path.display()))?;
        Ok(())
    }

    pub fn normalize(&mut self) {
        self.save_format = self.save_format.trim().to_lowercase();
        if !matches!(self.save_format.as_str(), "wav" | "mp3" | "ogg") {
            self.save_format = default_save_format();
        }
        if self.source_profile_name.trim().is_empty() {
            self.source_profile_name = self.profile.name.clone();
        }
        if let Some(s) = self.shortcut.as_mut() {
            *s = crate::quick_hotkeys::normalize_shortcut_string(s);
            if s.is_empty() {
                self.shortcut = None;
            }
        }
        self.profile.normalize();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FastWorkGeneration {
    pub id: String,
    pub created_at: i64,
    pub title: String,
    pub text: String,
    pub file_path: String,
    pub format: String,
    pub duration_ms: Option<u64>,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FastWorkSettingsView {
    pub profile_name: String,
    pub source_profile_name: String,
    pub save_format: String,
    pub shortcut: Option<String>,
    pub output_dir: String,
    pub exported_at: i64,
}
