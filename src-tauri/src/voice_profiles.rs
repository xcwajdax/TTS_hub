use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app_settings::{AppSettings, PROVIDER_GOOGLE, PROVIDER_MINIMAX, PROVIDER_VOICEBOX};
use crate::commands::GenerateReq;
use crate::google::SpeakerConfig;
use crate::minimax::{self, DEFAULT_MINIMAX_LANGUAGE};

/// Sources that carry an explicit voice-profile binding and must not be overridden.
const REROUTE_EXCLUDED_SOURCES: &[&str] = &["roleplay", "quick_hotkey"];

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
    pub personality_enabled: Option<bool>,
    #[serde(default)]
    pub minimax_speed: Option<f32>,
    #[serde(default)]
    pub minimax_vol: Option<f32>,
    #[serde(default)]
    pub minimax_pitch: Option<i32>,
    #[serde(default)]
    pub minimax_options: Option<crate::minimax::MinimaxSynthesisOptions>,
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
            personality_enabled: None,
            minimax_speed: None,
            minimax_vol: None,
            minimax_pitch: None,
            minimax_options: None,
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

    /// File-stem used under `avatars/voices/{provider}/`.
    /// Voice Box stores the server profile UUID, not the display name.
    pub fn avatar_voice_id(&self) -> &str {
        if self.provider.eq_ignore_ascii_case(PROVIDER_VOICEBOX) {
            self.profile_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(self.voice.trim())
        } else {
            self.voice.trim()
        }
    }
}

/// Candidate keys for `avatars/voices/{provider}/{key}.jpg`, first match wins.
/// Voice Box generations persist the display name in `gen.voice`, while the
/// avatar file is named after the server profile id.
pub fn generation_voice_avatar_keys(
    provider: &str,
    gen_voice: &str,
    voice_profile: Option<&TtsVoiceProfile>,
    request_profile_id: Option<&str>,
) -> Vec<String> {
    let mut keys = Vec::new();
    let mut push = |s: &str| {
        let t = s.trim();
        if !t.is_empty() && !keys.iter().any(|k| k == t) {
            keys.push(t.to_string());
        }
    };
    if let Some(profile) = voice_profile {
        push(profile.avatar_voice_id());
        push(profile.voice.trim());
    }
    if provider.eq_ignore_ascii_case(PROVIDER_VOICEBOX) {
        if let Some(pid) = request_profile_id {
            push(pid);
        }
    }
    push(gen_voice);
    keys
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

pub fn apply_voice_profile_tts_params(req: &mut GenerateReq, profile: &TtsVoiceProfile) {
    req.model = profile.model.clone();
    req.voice = profile.voice.clone();
    req.style = profile.style.clone();
    req.provider = Some(profile.provider.clone());
    req.profile_id = profile.profile_id.clone();
    req.language = profile.language.clone();
    req.engine = profile.engine.clone();
    req.personality = profile.personality_enabled;
    req.minimax_speed = profile.minimax_speed;
    req.minimax_vol = profile.minimax_vol;
    req.minimax_pitch = profile.minimax_pitch;
    req.minimax_options = profile.minimax_options.clone();
    req.multi_speaker = if profile.multi_speaker && !profile.speakers.is_empty() {
        Some(
            profile
                .speakers
                .iter()
                .map(|s| SpeakerConfig {
                    speaker: s.speaker.clone(),
                    voice: s.voice.clone(),
                })
                .collect(),
        )
    } else {
        None
    };
    req.voice_profile_id = Some(profile.id.clone());
}

pub fn apply_reroute_if_configured(settings: &AppSettings, mut req: GenerateReq) -> GenerateReq {
    let reroute_id = match settings.reroute_voice_profile_id.as_deref() {
        Some(id) if !id.trim().is_empty() => id,
        _ => return req,
    };
    let source = req
        .source
        .as_deref()
        .unwrap_or("manual")
        .trim()
        .to_ascii_lowercase();
    if REROUTE_EXCLUDED_SOURCES.contains(&source.as_str()) {
        return req;
    }
    let Some(profile) = find_voice_profile(&settings.voice_profiles, Some(reroute_id)) else {
        return req;
    };
    apply_voice_profile_tts_params(&mut req, profile);
    req
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_settings::AppSettings;

    #[test]
    fn reroute_overrides_cursor_request_voice_params() {
        let profile_id = "vp-reroute".to_string();
        let mut settings = AppSettings::default();
        settings.reroute_voice_profile_id = Some(profile_id.clone());
        settings.voice_profiles = vec![TtsVoiceProfile {
            id: profile_id,
            name: "Makłowicz".to_string(),
            provider: PROVIDER_MINIMAX.to_string(),
            model: "speech-2.8-hd".to_string(),
            voice: "robert_maklowicz".to_string(),
            style: Some("Powiedz:".to_string()),
            profile_id: None,
            language: Some("pl".to_string()),
            engine: None,
            minimax_speed: Some(0.9),
            minimax_vol: Some(1.0),
            minimax_pitch: Some(-2),
            multi_speaker: false,
            speakers: vec![],
            last_preview: None,
            last_preview_at: None,
            shortcut: None,
            shortcut_enabled: false,
            minimax_options: None,
            personality_enabled: None,
        }];

        let req = GenerateReq {
            text: "Test.".to_string(),
            model: "gemini-2.5-flash-preview-tts".to_string(),
            voice: "Kore".to_string(),
            style: None,
            format: "mp3".to_string(),
            multi_speaker: None,
            provider: Some(PROVIDER_GOOGLE.to_string()),
            profile_id: None,
            language: None,
            engine: None,
            personality: None,
            autoplay: true,
            source: Some("cursor-skill".to_string()),
            conversation_id: None,
            summary_text: None,
            filtered_text: None,
            filter_config: None,
            minimax_speed: None,
            minimax_vol: None,
            minimax_pitch: None,
            minimax_options: None,
            original_prompt: None,
            chat_session_id: None,
            chat_role: None,
            origin: None,
            voice_profile_id: None,
            context_label: None,
        };

        let out = apply_reroute_if_configured(&settings, req);
        assert_eq!(out.provider.as_deref(), Some(PROVIDER_MINIMAX));
        assert_eq!(out.voice, "robert_maklowicz");
        assert_eq!(out.minimax_pitch, Some(-2));
        assert_eq!(out.text, "Test.");
        assert_eq!(out.format, "mp3");
        assert_eq!(out.voice_profile_id.as_deref(), settings.reroute_voice_profile_id.as_deref());
    }

    #[test]
    fn reroute_skips_roleplay_source() {
        let profile_id = "vp-reroute".to_string();
        let mut settings = AppSettings::default();
        settings.reroute_voice_profile_id = Some(profile_id.clone());
        settings.voice_profiles = vec![TtsVoiceProfile {
            id: profile_id,
            ..TtsVoiceProfile::default()
        }];

        let req = GenerateReq {
            text: "Line.".to_string(),
            model: "gemini-2.5-flash-preview-tts".to_string(),
            voice: "Kore".to_string(),
            style: None,
            format: "wav".to_string(),
            multi_speaker: None,
            provider: Some(PROVIDER_GOOGLE.to_string()),
            profile_id: None,
            language: None,
            engine: None,
            personality: None,
            autoplay: false,
            source: Some("roleplay".to_string()),
            conversation_id: None,
            summary_text: None,
            filtered_text: None,
            filter_config: None,
            minimax_speed: None,
            minimax_vol: None,
            minimax_pitch: None,
            minimax_options: None,
            original_prompt: None,
            chat_session_id: None,
            chat_role: None,
            origin: None,
            voice_profile_id: Some("segment-profile".to_string()),
            context_label: None,
        };

        let out = apply_reroute_if_configured(&settings, req);
        assert_eq!(out.voice, "Kore");
        assert_eq!(out.voice_profile_id.as_deref(), Some("segment-profile"));
    }

    fn voicebox_profile(name: &str, server_id: &str) -> TtsVoiceProfile {
        TtsVoiceProfile {
            name: name.to_string(),
            provider: PROVIDER_VOICEBOX.to_string(),
            voice: name.to_string(),
            profile_id: Some(server_id.to_string()),
            ..TtsVoiceProfile::default()
        }
    }

    #[test]
    fn voicebox_avatar_id_uses_server_profile_not_display_name() {
        let profile = voicebox_profile("Marek", "vb-uuid-123");
        assert_eq!(profile.avatar_voice_id(), "vb-uuid-123");
    }

    #[test]
    fn generation_avatar_keys_prefer_voicebox_server_id() {
        let profile = voicebox_profile("Marek", "vb-uuid-123");
        let keys = generation_voice_avatar_keys(
            PROVIDER_VOICEBOX,
            "Marek",
            Some(&profile),
            Some("vb-uuid-123"),
        );
        assert_eq!(keys.first().map(String::as_str), Some("vb-uuid-123"));
        assert!(keys.contains(&"Marek".to_string()));
    }

    #[test]
    fn generation_avatar_keys_from_request_json_when_no_hub_profile() {
        let keys = generation_voice_avatar_keys(
            PROVIDER_VOICEBOX,
            "Marek",
            None,
            Some("vb-from-request"),
        );
        assert_eq!(keys, vec!["vb-from-request".to_string(), "Marek".to_string()]);
    }
}
