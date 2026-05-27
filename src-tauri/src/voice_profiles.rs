use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app_settings::{PROVIDER_GOOGLE, PROVIDER_MINIMAX, PROVIDER_VOICEBOX};
use crate::minimax::{self, DEFAULT_MINIMAX_LANGUAGE};

const ALL_PROVIDERS: &[&str] = &[PROVIDER_GOOGLE, PROVIDER_VOICEBOX, PROVIDER_MINIMAX];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsVoiceProfile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub voice: String,
    #[serde(default)]
    pub style: Option<String>,
    /// Voice Box profile id (not a saved TTS voice profile reference).
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
    #[serde(default)]
    pub multi_speaker: bool,
    #[serde(default)]
    pub speakers: Vec<VoiceProfileSpeaker>,
    /// One-line preview of the last generation using this profile (messenger list).
    #[serde(default)]
    pub last_preview: Option<String>,
    #[serde(default)]
    pub last_preview_at: Option<i64>,
    /// Global quick-TTS shortcut (synced to quick_hotkeys preset).
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub shortcut_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceProfileSpeaker {
    pub speaker: String,
    pub voice: String,
}

impl Default for TtsVoiceProfile {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "Profil głosu".to_string(),
            provider: PROVIDER_GOOGLE.to_string(),
            model: "gemini-2.5-flash-preview-tts".to_string(),
            voice: "Kore".to_string(),
            style: None,
            profile_id: None,
            language: None,
            engine: None,
            minimax_speed: None,
            minimax_vol: None,
            minimax_pitch: None,
            multi_speaker: false,
            speakers: Vec::new(),
            last_preview: None,
            last_preview_at: None,
            shortcut: None,
            shortcut_enabled: false,
        }
    }
}

impl TtsVoiceProfile {
    pub fn normalize(&mut self) {
        if self.id.trim().is_empty() {
            self.id = Uuid::new_v4().to_string();
        }
        self.name = self.name.trim().to_string();
        if self.name.is_empty() {
            self.name = "Profil głosu".to_string();
        }
        self.provider = self.provider.trim().to_lowercase();
        if !ALL_PROVIDERS.contains(&self.provider.as_str()) {
            self.provider = PROVIDER_GOOGLE.to_string();
        }
        self.model = self.model.trim().to_string();
        self.voice = self.voice.trim().to_string();
        if self.model.is_empty() {
            self.model = match self.provider.as_str() {
                PROVIDER_MINIMAX => "minimax:speech-2.8-hd".to_string(),
                PROVIDER_VOICEBOX => "voicebox:chatterbox".to_string(),
                _ => "gemini-2.5-flash-preview-tts".to_string(),
            };
        }
        if let Some(s) = self.style.as_mut() {
            *s = s.trim().to_string();
            if s.is_empty() {
                self.style = None;
            }
        }
        if let Some(id) = self.profile_id.as_mut() {
            *id = id.trim().to_string();
            if id.is_empty() {
                self.profile_id = None;
            }
        }
        if self.provider == PROVIDER_VOICEBOX {
            if self.profile_id.is_none() && !self.voice.is_empty() {
                self.profile_id = Some(self.voice.clone());
            }
            if self.language.is_none() {
                self.language = Some(DEFAULT_MINIMAX_LANGUAGE.to_string());
            }
        } else if self.provider == PROVIDER_MINIMAX {
            self.profile_id = None;
            let lang = self
                .language
                .take()
                .map(|l| l.trim().to_ascii_lowercase())
                .filter(|l| minimax::is_known_language_code(l));
            self.language = Some(lang.unwrap_or_else(|| DEFAULT_MINIMAX_LANGUAGE.to_string()));
            if self.minimax_speed.is_none() {
                self.minimax_speed = Some(1.0);
                self.minimax_vol = Some(1.0);
                self.minimax_pitch = Some(0);
            }
        } else {
            self.profile_id = None;
            self.language = None;
            self.engine = None;
            self.minimax_speed = None;
            self.minimax_vol = None;
            self.minimax_pitch = None;
        }
        if self.provider != PROVIDER_GOOGLE {
            self.multi_speaker = false;
            self.speakers.clear();
        }
        for sp in &mut self.speakers {
            sp.speaker = sp.speaker.trim().to_string();
            sp.voice = sp.voice.trim().to_string();
        }
        self.speakers.retain(|s| !s.speaker.is_empty() && !s.voice.is_empty());
        if let Some(preview) = self.last_preview.as_mut() {
            *preview = preview.trim().to_string();
            if preview.is_empty() {
                self.last_preview = None;
                self.last_preview_at = None;
            }
        }
        if self.last_preview.is_none() {
            self.last_preview_at = None;
        }
        if let Some(sc) = self.shortcut.as_mut() {
            *sc = crate::quick_hotkeys::migrate_legacy_shortcut(sc.trim());
            if sc.is_empty() {
                self.shortcut = None;
                self.shortcut_enabled = false;
            }
        } else {
            self.shortcut_enabled = false;
        }
    }
}

pub fn find_voice_profile<'a>(
    profiles: &'a [TtsVoiceProfile],
    id: Option<&str>,
) -> Option<&'a TtsVoiceProfile> {
    let id = id?.trim();
    if id.is_empty() {
        return None;
    }
    profiles.iter().find(|p| p.id == id)
}

pub fn normalize_voice_profiles(profiles: &mut Vec<TtsVoiceProfile>) {
    let mut seen = std::collections::HashSet::new();
    for p in profiles.iter_mut() {
        p.normalize();
        if !seen.insert(p.id.clone()) {
            p.id = Uuid::new_v4().to_string();
            seen.insert(p.id.clone());
        }
    }
}
