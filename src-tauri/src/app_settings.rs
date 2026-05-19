use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveMode {
    Manual,
    Auto,
}

impl Default for SaveMode {
    fn default() -> Self {
        Self::Manual
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProfile {
    pub id: String,
    pub name: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorIntegration {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub autoplay: bool,
    #[serde(default = "default_max_sentences")]
    pub max_sentences: u32,
    #[serde(default = "default_cursor_model")]
    pub model: String,
    #[serde(default = "default_cursor_voice")]
    pub voice: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default = "default_true")]
    pub use_summary_markers: bool,
    #[serde(default)]
    pub dnd_until_ts: Option<i64>,
    #[serde(default)]
    pub last_install_ts: Option<i64>,
}

fn default_true() -> bool { true }
fn default_max_sentences() -> u32 { 10 }
fn default_cursor_model() -> String { "gemini-2.5-flash-preview-tts".to_string() }
fn default_cursor_voice() -> String { "Kore".to_string() }

impl Default for CursorIntegration {
    fn default() -> Self {
        Self {
            enabled: false,
            autoplay: true,
            max_sentences: 10,
            model: default_cursor_model(),
            voice: default_cursor_voice(),
            style: Some("Powiedz spokojnie po polsku:".to_string()),
            use_summary_markers: true,
            dnd_until_ts: None,
            last_install_ts: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub save_mode: SaveMode,
    #[serde(default = "default_save_format")]
    pub save_format: String,
    pub temp_path: Option<String>,
    pub archive_path: Option<String>,
    #[serde(default)]
    pub api_profiles: Vec<ApiProfile>,
    pub active_api_id: Option<String>,
    #[serde(default)]
    pub cursor_integration: CursorIntegration,
}

fn default_save_format() -> String {
    "wav".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            save_mode: SaveMode::Manual,
            save_format: default_save_format(),
            temp_path: None,
            archive_path: None,
            api_profiles: Vec::new(),
            active_api_id: None,
            cursor_integration: CursorIntegration::default(),
        }
    }
}

impl AppSettings {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let raw = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
        let mut settings: Self = serde_json::from_str(&raw).context("parse settings.json")?;
        settings.normalize();
        Ok(settings)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut copy = self.clone();
        copy.normalize();
        let raw = serde_json::to_string_pretty(&copy)?;
        std::fs::write(path, raw)?;
        Ok(())
    }

    pub fn active_google_key(&self, env_key: &str) -> String {
        if let Some(id) = &self.active_api_id {
            if let Some(profile) = self.api_profiles.iter().find(|p| p.id == *id) {
                let key = profile.api_key.trim();
                if !key.is_empty() {
                    return key.to_string();
                }
            }
        }
        env_key.to_string()
    }

    pub fn normalize(&mut self) {
        self.save_format = self.save_format.trim().to_lowercase();
        if !matches!(self.save_format.as_str(), "wav" | "mp3" | "ogg") {
            self.save_format = default_save_format();
        }
        self.temp_path = normalize_optional_path(self.temp_path.take());
        self.archive_path = normalize_optional_path(self.archive_path.take());
        for profile in &mut self.api_profiles {
            if profile.id.trim().is_empty() {
                profile.id = Uuid::new_v4().to_string();
            }
            profile.name = profile.name.trim().to_string();
            if profile.name.is_empty() {
                profile.name = "Profil API".to_string();
            }
        }
        if let Some(id) = &self.active_api_id {
            if !self.api_profiles.iter().any(|p| p.id == *id) {
                self.active_api_id = None;
            }
        }
    }
}

fn normalize_optional_path(value: Option<String>) -> Option<String> {
    value
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn new_api_profile(name: impl Into<String>, api_key: impl Into<String>) -> ApiProfile {
    ApiProfile {
        id: Uuid::new_v4().to_string(),
        name: name.into(),
        api_key: api_key.into(),
    }
}
