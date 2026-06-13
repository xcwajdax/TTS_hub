use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const MAX_QUICK_HOTKEY_PRESETS: usize = 32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickHotkeyPreset {
    pub id: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_preset_name")]
    pub name: String,
    #[serde(default = "default_shortcut")]
    pub shortcut: String,
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_voice")]
    pub voice: String,
    #[serde(default)]
    pub style: Option<String>,
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
    pub minimax_options: Option<crate::minimax::MinimaxSynthesisOptions>,
    #[serde(default)]
    pub load_editor: bool,
    #[serde(default = "default_true")]
    pub autoplay: bool,
    #[serde(default)]
    pub filter_preset_id: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub voice_profile_id: Option<String>,
}

fn default_true() -> bool {
    true
}
fn default_preset_name() -> String {
    "Szybki TTS".to_string()
}
fn default_shortcut() -> String {
    "Ctrl+Alt+1".to_string()
}
fn default_provider() -> String {
    "google".to_string()
}
fn default_model() -> String {
    "gemini-2.5-flash-preview-tts".to_string()
}
fn default_voice() -> String {
    "Kore".to_string()
}

impl Default for QuickHotkeyPreset {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            enabled: true,
            name: default_preset_name(),
            shortcut: default_shortcut(),
            provider: default_provider(),
            model: default_model(),
            voice: default_voice(),
            style: Some("Powiedz spokojnie po polsku:".to_string()),
            profile_id: None,
            language: Some("pl".to_string()),
            engine: None,
            minimax_speed: Some(1.0),
            minimax_vol: Some(1.0),
            minimax_pitch: Some(0),
            minimax_options: None,
            load_editor: false,
            autoplay: true,
            filter_preset_id: None,
            format: None,
            voice_profile_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickHotkeysSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_presets")]
    pub presets: Vec<QuickHotkeyPreset>,
}

fn default_presets() -> Vec<QuickHotkeyPreset> {
    vec![QuickHotkeyPreset::default()]
}

impl Default for QuickHotkeysSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            presets: default_presets(),
        }
    }
}

impl QuickHotkeysSettings {
    pub fn normalize(&mut self) {
        if self.presets.len() > MAX_QUICK_HOTKEY_PRESETS {
            self.presets.truncate(MAX_QUICK_HOTKEY_PRESETS);
        }
        if self.presets.is_empty() {
            self.presets.push(QuickHotkeyPreset::default());
        }
        for preset in &mut self.presets {
            preset.normalize();
        }
        // Disable duplicate shortcuts among enabled presets.
        let mut seen = std::collections::HashSet::new();
        for preset in &mut self.presets {
            if !self.enabled || !preset.enabled {
                continue;
            }
            let key = preset.shortcut.to_lowercase();
            if key.is_empty() || !seen.insert(key) {
                preset.enabled = false;
            }
        }
    }

    pub fn find_preset(&self, id: &str) -> Option<&QuickHotkeyPreset> {
        self.presets.iter().find(|p| p.id == id)
    }
}

impl QuickHotkeyPreset {
    pub fn normalize(&mut self) {
        if self.id.trim().is_empty() {
            self.id = Uuid::new_v4().to_string();
        }
        self.name = self.name.trim().to_string();
        if self.name.is_empty() {
            self.name = default_preset_name();
        }
        self.shortcut = migrate_legacy_shortcut(&normalize_shortcut_string(&self.shortcut));
        self.provider = self.provider.trim().to_lowercase();
        if !matches!(self.provider.as_str(), "google" | "voicebox" | "minimax") {
            self.provider = default_provider();
        }
        self.model = self.model.trim().to_string();
        if self.model.is_empty() {
            self.model = default_model();
        }
        self.voice = self.voice.trim().to_string();
        if self.voice.is_empty() {
            self.voice = default_voice();
        }
        self.style = self
            .style
            .take()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        self.profile_id = trim_opt(self.profile_id.take());
        self.language = trim_opt(self.language.take());
        self.engine = trim_opt(self.engine.take());
        if let Some(speed) = self.minimax_speed {
            self.minimax_speed = Some(speed.clamp(0.5, 2.0));
        }
        if let Some(vol) = self.minimax_vol {
            self.minimax_vol = Some(vol.clamp(0.0, 10.0));
        }
        if let Some(pitch) = self.minimax_pitch {
            self.minimax_pitch = Some(pitch.clamp(-12, 12));
        }
        self.filter_preset_id = trim_opt(self.filter_preset_id.take());
        self.voice_profile_id = trim_opt(self.voice_profile_id.take());
        if let Some(fmt) = self.format.take() {
            let f = fmt.trim().to_lowercase();
            self.format = if matches!(f.as_str(), "wav" | "mp3" | "ogg") {
                Some(f)
            } else {
                None
            };
        }
        if self.enabled && self.shortcut.is_empty() {
            self.enabled = false;
        }
    }
}

fn trim_opt(value: Option<String>) -> Option<String> {
    value
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Skraca legacy Ctrl+Shift+Alt+N → Ctrl+Alt+N
pub fn migrate_legacy_shortcut(shortcut: &str) -> String {
    const PREFIX: &str = "Ctrl+Shift+Alt+";
    if shortcut.starts_with(PREFIX) {
        return format!("Ctrl+Alt+{}", &shortcut[PREFIX.len()..]);
    }
    shortcut.to_string()
}

/// Normalize shortcut to plugin-friendly form: Ctrl+Alt+1
pub fn normalize_shortcut_string(raw: &str) -> String {
    let parts: Vec<String> = raw
        .split('+')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .map(normalize_shortcut_part)
        .collect();
    parts.join("+")
}

fn normalize_shortcut_part(part: &str) -> String {
    let lower = part.to_lowercase();
    match lower.as_str() {
        "control" | "ctrl" => "Ctrl".to_string(),
        "shift" => "Shift".to_string(),
        "alt" | "option" => "Alt".to_string(),
        "meta" | "cmd" | "command" | "super" | "win" => "Super".to_string(),
        key if key.len() == 1 => key.to_uppercase(),
        key if key.starts_with('f') && key.len() <= 3 => key.to_uppercase(),
        key if key == "space" => "Space".to_string(),
        key if key == "enter" || key == "return" => "Enter".to_string(),
        key if key == "escape" || key == "esc" => "Escape".to_string(),
        key if key == "tab" => "Tab".to_string(),
        _ => {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}

use std::sync::Arc;

use tauri::{AppHandle, Emitter};

use crate::app_settings::AppSettings;
use crate::commands::{enqueue_request, GenerateReq};
use crate::google::SpeakerConfig;
use crate::voice_profiles::find_voice_profile;
use crate::db::Generation;
use crate::selection_capture;
use crate::state::AppState;
use crate::text_filters::TextFilterPreset;

type AppArc = Arc<AppState>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickHotkeyLoadEditorEvent {
    pub text: String,
    pub preset_id: String,
    pub generation_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickHotkeyErrorEvent {
    pub message: String,
    pub preset_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickHotkeyStartedEvent {
    pub preset_id: String,
    pub preset_name: String,
}

pub fn build_generate_req(
    preset: &QuickHotkeyPreset,
    settings: &AppSettings,
    text: String,
) -> GenerateReq {
    let format = preset
        .format
        .clone()
        .unwrap_or_else(|| settings.save_format.clone());
    let filter_config = resolve_filter_preset(settings, preset);

    let saved = find_voice_profile(&settings.voice_profiles, preset.voice_profile_id.as_deref());

    let provider = saved
        .map(|p| p.provider.clone())
        .unwrap_or_else(|| preset.provider.clone());
    let model = saved
        .map(|p| p.model.clone())
        .unwrap_or_else(|| preset.model.clone());
    let voice = saved
        .map(|p| p.voice.clone())
        .unwrap_or_else(|| preset.voice.clone());
    let style = saved
        .and_then(|p| p.style.clone())
        .or_else(|| preset.style.clone());
    let profile_id = saved
        .and_then(|p| p.profile_id.clone())
        .or_else(|| preset.profile_id.clone());
    let language = saved
        .and_then(|p| p.language.clone())
        .or_else(|| preset.language.clone());
    let engine = saved
        .and_then(|p| p.engine.clone())
        .or_else(|| preset.engine.clone());
    let minimax_speed = saved
        .and_then(|p| p.minimax_speed)
        .or(preset.minimax_speed);
    let minimax_vol = saved.and_then(|p| p.minimax_vol).or(preset.minimax_vol);
    let minimax_pitch = saved
        .and_then(|p| p.minimax_pitch)
        .or(preset.minimax_pitch);

    let multi_speaker = saved.and_then(|p| {
        if p.multi_speaker && !p.speakers.is_empty() {
            Some(
                p.speakers
                    .iter()
                    .map(|s| SpeakerConfig {
                        speaker: s.speaker.clone(),
                        voice: s.voice.clone(),
                    })
                    .collect(),
            )
        } else {
            None
        }
    });

    GenerateReq {
        text,
        model,
        voice,
        style,
        format,
        multi_speaker,
        provider: Some(provider),
        profile_id,
        language,
        engine,
        personality: None,
        autoplay: preset.autoplay,
        source: Some("quick_hotkey".to_string()),
        conversation_id: None,
        summary_text: None,
        filtered_text: None,
        filter_config,
        minimax_speed,
        minimax_vol,
        minimax_pitch,
        minimax_options: saved.and_then(|p| p.minimax_options.clone()),
        original_prompt: None,
        chat_session_id: None,
        chat_role: None,
        // Desktop UI does not currently set an origin block.
        origin: None,
        // === voice-profile attribution (2026-06-09) ===
        // Quick hotkey path uses the preset's optional `voice_profile_id`
        // so history items carry the badge back to the saved profile.
        voice_profile_id: preset.voice_profile_id.clone(),
    }
}

fn resolve_filter_preset(
    settings: &AppSettings,
    preset: &QuickHotkeyPreset,
) -> Option<TextFilterPreset> {
    let id = preset.filter_preset_id.as_ref()?;
    settings
        .text_filters
        .presets
        .iter()
        .find(|p| &p.id == id)
        .cloned()
}

pub fn run_preset(app: &AppHandle, state: &AppArc, preset_id: &str) -> Result<Generation, String> {
    let (preset, settings) = {
        let settings_guard = state.settings.read().map_err(|e| format!("{e}"))?;
        let enabled = settings_guard.quick_hotkeys.enabled;
        let preset = settings_guard
            .quick_hotkeys
            .find_preset(preset_id)
            .ok_or_else(|| format!("Nie znaleziono skrótu: {preset_id}"))?
            .clone();
        if !enabled {
            return Err("Szybkie skróty są wyłączone w ustawieniach.".into());
        }
        if !preset.enabled {
            return Err(format!("Skrót „{}” jest wyłączony.", preset.name));
        }
        (preset, settings_guard.clone())
    };

    let _ = crate::toast_window::show(app);
    let _ = app.emit(
        "quick-hotkey:started",
        QuickHotkeyStartedEvent {
            preset_id: preset.id.clone(),
            preset_name: preset.name.clone(),
        },
    );

    let text = selection_capture::capture_selection_text(app)?;

    let req = build_generate_req(&preset, &settings, text.clone());
    let generation = enqueue_request(state, req)?;
    let _ = app.emit("quick-hotkey:queued", &generation);

    if preset.load_editor {
        let _ = app.emit(
            "quick-hotkey:load-editor",
            QuickHotkeyLoadEditorEvent {
                text,
                preset_id: preset.id.clone(),
                generation_id: generation.id.clone(),
            },
        );
    }

    Ok(generation)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn reload_from_settings(app: &AppHandle, state: &AppArc) -> Result<(), String> {
    crate::global_shortcuts::reload_all(app, state)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn reload_from_settings(_app: &AppHandle, _state: &AppArc) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_shortcut() {
        assert_eq!(normalize_shortcut_string("ctrl + alt + 1"), "Ctrl+Alt+1");
    }

    #[test]
    fn migrates_legacy_shortcut() {
        assert_eq!(migrate_legacy_shortcut("Ctrl+Shift+Alt+2"), "Ctrl+Alt+2");
        assert_eq!(migrate_legacy_shortcut("Ctrl+Alt+1"), "Ctrl+Alt+1");
    }
}
