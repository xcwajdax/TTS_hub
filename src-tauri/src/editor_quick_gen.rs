use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorQuickGenSlot {
    #[serde(default = "default_slot1_label")]
    pub label: String,
    #[serde(default = "default_google_provider")]
    pub provider: String,
    #[serde(default = "default_google_model")]
    pub model: String,
    #[serde(default = "default_google_voice")]
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
    pub filter_preset_id: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
    /// Saved TTS voice profile (`voice_profiles` in settings.json).
    #[serde(default)]
    pub voice_profile_id: Option<String>,
}

fn default_slot1_label() -> String {
    "Gen Ust 1".to_string()
}
fn default_slot2_label() -> String {
    "Gen Ust 2".to_string()
}
fn default_google_provider() -> String {
    "google".to_string()
}
fn default_google_model() -> String {
    "gemini-2.5-flash-preview-tts".to_string()
}
fn default_google_voice() -> String {
    "Kore".to_string()
}

impl Default for EditorQuickGenSlot {
    fn default() -> Self {
        Self {
            label: default_slot1_label(),
            provider: default_google_provider(),
            model: default_google_model(),
            voice: default_google_voice(),
            style: Some("Powiedz spokojnie po polsku:".to_string()),
            profile_id: None,
            language: Some("pl".to_string()),
            engine: None,
            minimax_speed: Some(1.0),
            minimax_vol: Some(1.0),
            minimax_pitch: Some(0),
            filter_preset_id: None,
            format: None,
            voice_profile_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorQuickGenSettings {
    #[serde(default)]
    pub slot1: EditorQuickGenSlot,
    #[serde(default = "default_slot2")]
    pub slot2: EditorQuickGenSlot,
}

fn default_slot2() -> EditorQuickGenSlot {
    EditorQuickGenSlot {
        label: default_slot2_label(),
        ..EditorQuickGenSlot::default()
    }
}

impl Default for EditorQuickGenSettings {
    fn default() -> Self {
        Self {
            slot1: EditorQuickGenSlot::default(),
            slot2: default_slot2(),
        }
    }
}

impl EditorQuickGenSettings {
    pub fn normalize(&mut self) {
        self.slot1.normalize_with_default_label(default_slot1_label());
        self.slot2.normalize_with_default_label(default_slot2_label());
    }
}

impl EditorQuickGenSlot {
    pub fn normalize_with_default_label(&mut self, default_label: String) {
        self.label = self.label.trim().to_string();
        if self.label.is_empty() {
            self.label = default_label;
        }
        self.provider = self.provider.trim().to_lowercase();
        self.model = self.model.trim().to_string();
        self.voice = self.voice.trim().to_string();
        if let Some(s) = self.style.as_mut() {
            *s = s.trim().to_string();
            if s.is_empty() {
                self.style = None;
            }
        }
        if let Some(fmt) = self.format.as_mut() {
            *fmt = fmt.trim().to_lowercase();
            if !matches!(fmt.as_str(), "wav" | "mp3" | "ogg") {
                self.format = None;
            }
        }
        if let Some(id) = self.voice_profile_id.as_mut() {
            *id = id.trim().to_string();
            if id.is_empty() {
                self.voice_profile_id = None;
            }
        }
    }
}
