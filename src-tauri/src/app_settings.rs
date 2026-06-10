use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

use crate::editor_quick_gen::EditorQuickGenSettings;
use crate::minimax::{
    self, MinimaxClonedVoice, MinimaxPresetVoice, DEFAULT_MINIMAX_LANGUAGE,
    DEFAULT_MINIMAX_VOICE_ID,
};
use crate::quick_hotkeys::QuickHotkeysSettings;
use crate::text_filters::TextFiltersSettings;
use crate::voice_profiles::{normalize_voice_profiles, TtsVoiceProfile};

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
    #[serde(default = "default_cursor_provider")]
    pub provider: String,
    #[serde(default = "default_cursor_model")]
    pub model: String,
    #[serde(default = "default_cursor_voice")]
    pub voice: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub minimax_speed: Option<f32>,
    #[serde(default)]
    pub minimax_vol: Option<f32>,
    #[serde(default)]
    pub minimax_pitch: Option<i32>,
    #[serde(default = "default_true")]
    pub use_summary_markers: bool,
    #[serde(default)]
    pub dnd_until_ts: Option<i64>,
    #[serde(default)]
    pub last_install_ts: Option<i64>,
}

fn default_true() -> bool {
    true
}
fn default_max_sentences() -> u32 {
    10
}
fn default_cursor_provider() -> String {
    PROVIDER_MINIMAX.to_string()
}
fn default_cursor_model() -> String {
    "speech-2.8-hd".to_string()
}
fn default_cursor_voice() -> String {
    DEFAULT_MINIMAX_VOICE_ID.to_string()
}

impl CursorIntegration {
    pub fn normalize(&mut self) {
        self.provider = self.provider.trim().to_lowercase();
        if !ALL_PROVIDERS.contains(&self.provider.as_str()) {
            self.provider = default_cursor_provider();
        }
        self.model = self.model.trim().to_string();
        self.voice = self.voice.trim().to_string();
        if self.model.is_empty() {
            self.model = match self.provider.as_str() {
                PROVIDER_MINIMAX => "speech-2.8-hd".to_string(),
                PROVIDER_VOICEBOX => "voicebox:chatterbox".to_string(),
                _ => "gemini-2.5-flash-preview-tts".to_string(),
            };
        }
        if self.voice.is_empty() {
            self.voice = match self.provider.as_str() {
                PROVIDER_MINIMAX => minimax::MinimaxClient::default_voice_for_language(
                    self.language.as_deref().unwrap_or(DEFAULT_MINIMAX_LANGUAGE),
                )
                .to_string(),
                PROVIDER_VOICEBOX => String::new(),
                _ => "Kore".to_string(),
            };
        }
        if let Some(fmt) = self.format.as_mut() {
            *fmt = fmt.trim().to_lowercase();
            if !matches!(fmt.as_str(), "wav" | "mp3" | "ogg") {
                *fmt = String::new();
            }
            if fmt.is_empty() {
                self.format = None;
            }
        }
        if self.format.is_none() {
            self.format = Some(match self.provider.as_str() {
                PROVIDER_MINIMAX => "mp3".to_string(),
                _ => "wav".to_string(),
            });
        }
        if let Some(speed) = self.minimax_speed {
            self.minimax_speed = Some(speed.clamp(0.5, 2.0));
        }
        if let Some(vol) = self.minimax_vol {
            self.minimax_vol = Some(vol.clamp(0.0, 10.0));
        }
        if let Some(pitch) = self.minimax_pitch {
            self.minimax_pitch = Some(pitch.clamp(-12, 12));
        }
        if self.provider != PROVIDER_MINIMAX {
            self.minimax_speed = None;
            self.minimax_vol = None;
            self.minimax_pitch = None;
        } else if self.minimax_speed.is_none() {
            self.minimax_speed = Some(1.0);
            self.minimax_vol = Some(1.0);
            self.minimax_pitch = Some(0);
        }
        if self.provider == PROVIDER_VOICEBOX {
            if self.language.is_none() {
                self.language = Some(DEFAULT_MINIMAX_LANGUAGE.to_string());
            }
            self.engine = self.engine.take().filter(|e| !e.trim().is_empty());
        } else if self.provider == PROVIDER_MINIMAX {
            self.profile_id = None;
            self.engine = None;
            let lang = self
                .language
                .take()
                .map(|l| l.trim().to_ascii_lowercase())
                .filter(|l| minimax::is_known_language_code(l));
            self.language = Some(lang.unwrap_or_else(|| DEFAULT_MINIMAX_LANGUAGE.to_string()));
        } else {
            self.profile_id = None;
            self.language = None;
            self.engine = None;
        }
    }
}

impl Default for CursorIntegration {
    fn default() -> Self {
        Self {
            enabled: false,
            autoplay: true,
            max_sentences: 10,
            provider: default_cursor_provider(),
            model: default_cursor_model(),
            voice: default_cursor_voice(),
            style: None,
            format: Some("mp3".to_string()),
            profile_id: None,
            language: Some(DEFAULT_MINIMAX_LANGUAGE.to_string()),
            engine: None,
            minimax_speed: Some(1.0),
            minimax_vol: Some(1.0),
            minimax_pitch: Some(0),
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
    #[serde(default = "default_max_concurrent_jobs")]
    pub max_concurrent_jobs: u32,
    #[serde(default = "default_active_skin_id")]
    pub active_skin_id: String,
    #[serde(default)]
    pub skin_registry_urls: Vec<String>,
    #[serde(default)]
    pub text_filters: TextFiltersSettings,
    #[serde(default)]
    pub minimax_cloned_voices: Vec<MinimaxClonedVoice>,
    /// System voices from last `get_voice` API sync; empty = built-in catalog.
    #[serde(default)]
    pub minimax_synced_voices: Vec<MinimaxPresetVoice>,
    #[serde(default)]
    pub minimax_voices_synced_at: Option<i64>,
    #[serde(default)]
    pub quick_hotkeys: QuickHotkeysSettings,
    #[serde(default)]
    pub editor_quick_gen: EditorQuickGenSettings,
    #[serde(default)]
    pub voice_profiles: Vec<TtsVoiceProfile>,
    /// When set, incoming generation requests (except roleplay / quick hotkeys)
    /// are forced through this saved voice profile regardless of caller params.
    #[serde(default)]
    pub reroute_voice_profile_id: Option<String>,
    #[serde(default)]
    pub quick_setup_completed: bool,
    #[serde(default)]
    pub enabled_providers: Vec<String>,
    #[serde(default = "default_minimax_enabled_languages")]
    pub minimax_enabled_languages: Vec<String>,
    pub voicebox_base_url: Option<String>,
    pub minimax_api_key: Option<String>,
    /// Max non-archived temp history rows from prior app sessions (current session always kept).
    #[serde(default = "default_temp_history_max")]
    pub temp_history_max: u32,
    /// Main playback bar waveform: bars | bars-detailed | line
    #[serde(default = "default_timeline_view")]
    pub timeline_view: String,
    /// When true, new generations are held for user approval before synthesis.
    #[serde(default)]
    pub safe_mode: bool,
    /// Expand the queue panel and switch to approval tab when a pending item arrives.
    #[serde(default = "default_safe_mode_auto_open_queue")]
    pub safe_mode_auto_open_queue: bool,
}

fn default_safe_mode_auto_open_queue() -> bool {
    true
}

fn default_minimax_enabled_languages() -> Vec<String> {
    vec![DEFAULT_MINIMAX_LANGUAGE.to_string()]
}

pub const PROVIDER_GOOGLE: &str = "google";
pub const PROVIDER_VOICEBOX: &str = "voicebox";
pub const PROVIDER_MINIMAX: &str = "minimax";

const ALL_PROVIDERS: &[&str] = &[PROVIDER_GOOGLE, PROVIDER_VOICEBOX, PROVIDER_MINIMAX];

fn default_active_skin_id() -> String {
    "vibelife".to_string()
}

fn default_save_format() -> String {
    "wav".to_string()
}

pub const MIN_CONCURRENT_JOBS: u32 = 1;
pub const MAX_CONCURRENT_JOBS_CAP: u32 = 8;

fn default_max_concurrent_jobs() -> u32 {
    3
}

pub const MIN_TEMP_HISTORY_MAX: u32 = 10;
pub const MAX_TEMP_HISTORY_MAX: u32 = 500;

fn default_temp_history_max() -> u32 {
    100
}

fn default_timeline_view() -> String {
    "bars".to_string()
}

const TIMELINE_VIEWS: &[&str] = &["bars", "bars-detailed", "line"];

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
            max_concurrent_jobs: default_max_concurrent_jobs(),
            active_skin_id: default_active_skin_id(),
            skin_registry_urls: Vec::new(),
            text_filters: TextFiltersSettings::default(),
            minimax_cloned_voices: Vec::new(),
            minimax_synced_voices: Vec::new(),
            minimax_voices_synced_at: None,
            quick_hotkeys: QuickHotkeysSettings::default(),
            editor_quick_gen: EditorQuickGenSettings::default(),
            voice_profiles: Vec::new(),
            reroute_voice_profile_id: None,
            quick_setup_completed: false,
            enabled_providers: Vec::new(),
            minimax_enabled_languages: default_minimax_enabled_languages(),
            voicebox_base_url: None,
            minimax_api_key: None,
            temp_history_max: default_temp_history_max(),
            timeline_view: default_timeline_view(),
            safe_mode: false,
            safe_mode_auto_open_queue: default_safe_mode_auto_open_queue(),
        }
    }
}

/// Strips UTF-8 BOM and surrounding whitespace (PowerShell / some editors add BOM).
fn prepare_settings_json(raw: &str) -> &str {
    raw.strip_prefix('\u{feff}').unwrap_or(raw).trim()
}

impl AppSettings {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let raw =
            std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
        let json = prepare_settings_json(&raw);
        if json.is_empty() {
            return Ok(Self::default());
        }

        match serde_json::from_str::<Self>(json) {
            Ok(mut settings) => {
                settings.normalize();
                Ok(settings)
            }
            Err(e) => {
                let backup = path.with_extension("json.bak");
                if std::fs::copy(path, &backup).is_ok() {
                    eprintln!(
                        "settings.json: parse failed ({e}); backup at {}",
                        backup.display()
                    );
                } else {
                    eprintln!("settings.json: parse failed ({e})");
                }
                Ok(Self::default())
            }
        }
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

    pub fn effective_voicebox_url(&self, env_url: &str) -> String {
        self.voicebox_base_url
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| {
                let e = env_url.trim();
                if e.is_empty() {
                    "http://127.0.0.1:17493".to_string()
                } else {
                    e.trim_end_matches('/').to_string()
                }
            })
    }

    pub fn effective_minimax_key(&self, env_key: &str) -> String {
        self.minimax_api_key
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| env_key.trim().to_string())
    }

    pub fn is_provider_enabled(&self, id: &str) -> bool {
        if self.enabled_providers.is_empty() {
            return true;
        }
        self.enabled_providers.iter().any(|p| p == id)
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
        if self.max_concurrent_jobs < MIN_CONCURRENT_JOBS {
            self.max_concurrent_jobs = MIN_CONCURRENT_JOBS;
        } else if self.max_concurrent_jobs > MAX_CONCURRENT_JOBS_CAP {
            self.max_concurrent_jobs = MAX_CONCURRENT_JOBS_CAP;
        }
        if self.temp_history_max < MIN_TEMP_HISTORY_MAX {
            self.temp_history_max = MIN_TEMP_HISTORY_MAX;
        } else if self.temp_history_max > MAX_TEMP_HISTORY_MAX {
            self.temp_history_max = MAX_TEMP_HISTORY_MAX;
        }
        self.active_skin_id = self.active_skin_id.trim().to_string();
        if self.active_skin_id.is_empty() {
            self.active_skin_id = default_active_skin_id();
        }
        self.skin_registry_urls = self
            .skin_registry_urls
            .iter()
            .map(|u| u.trim().to_string())
            .filter(|u| !u.is_empty())
            .collect();
        self.text_filters.normalize();
        self.cursor_integration.normalize();
        self.quick_hotkeys.normalize();
        self.editor_quick_gen.normalize();
        normalize_voice_profiles(&mut self.voice_profiles);
        if let Some(id) = self.reroute_voice_profile_id.take() {
            let trimmed = id.trim().to_string();
            if trimmed.is_empty() || !self.voice_profiles.iter().any(|p| p.id == trimmed) {
                self.reroute_voice_profile_id = None;
            } else {
                self.reroute_voice_profile_id = Some(trimmed);
            }
        }
        self.voicebox_base_url = normalize_optional_path(self.voicebox_base_url.take());
        self.minimax_api_key = self
            .minimax_api_key
            .take()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let mut seen = std::collections::HashSet::new();
        self.enabled_providers = self
            .enabled_providers
            .iter()
            .map(|p| p.trim().to_lowercase())
            .filter(|p| ALL_PROVIDERS.contains(&p.as_str()))
            .filter(|p| seen.insert(p.clone()))
            .collect();
        let mut lang_seen = std::collections::HashSet::new();
        self.minimax_enabled_languages = self
            .minimax_enabled_languages
            .iter()
            .map(|c| c.trim().to_ascii_lowercase())
            .filter(|c| minimax::is_known_language_code(c))
            .filter(|c| lang_seen.insert(c.clone()))
            .collect();
        self.timeline_view = self.timeline_view.trim().to_ascii_lowercase();
        if !TIMELINE_VIEWS.contains(&self.timeline_view.as_str()) {
            self.timeline_view = default_timeline_view();
        }
        for v in &mut self.minimax_cloned_voices {
            v.normalize_output_vol();
            if v.voice_id.eq_ignore_ascii_case("robert_maklowicz") && v.output_vol.is_none() {
                v.output_vol = Some(2.0);
            }
        }
    }

    pub fn effective_minimax_enabled_languages(&self) -> Vec<String> {
        minimax::effective_enabled_language_codes(&self.minimax_enabled_languages)
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
