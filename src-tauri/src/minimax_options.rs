use serde::{Deserialize, Serialize};

/// Hub language code → MiniMax `language_boost` API value + display label.
pub const MINIMAX_LANGUAGE_CATALOG: &[(&str, &str, &str)] = &[
    ("pl", "Polish", "Polski"),
    ("en", "English", "Angielski"),
    ("zh", "Chinese", "Chiński (mandaryński)"),
    ("yue", "Chinese,Yue", "Kantoński"),
    ("ar", "Arabic", "Arabski"),
    ("ru", "Russian", "Rosyjski"),
    ("es", "Spanish", "Hiszpański"),
    ("fr", "French", "Francuski"),
    ("pt", "Portuguese", "Portugalski"),
    ("de", "German", "Niemiecki"),
    ("tr", "Turkish", "Turecki"),
    ("nl", "Dutch", "Niderlandzki"),
    ("uk", "Ukrainian", "Ukraiński"),
    ("vi", "Vietnamese", "Wietnamski"),
    ("id", "Indonesian", "Indonezyjski"),
    ("ja", "Japanese", "Japoński"),
    ("it", "Italian", "Włoski"),
    ("ko", "Korean", "Koreański"),
    ("th", "Thai", "Tajski"),
    ("ro", "Romanian", "Rumuński"),
    ("el", "Greek", "Grecki"),
    ("cs", "Czech", "Czeski"),
    ("fi", "Finnish", "Fiński"),
    ("hi", "Hindi", "Hindi"),
    ("bg", "Bulgarian", "Bułgarski"),
    ("da", "Danish", "Duński"),
    ("he", "Hebrew", "Hebrajski"),
    ("ms", "Malay", "Malajski"),
    ("fa", "Persian", "Perski"),
    ("sk", "Slovak", "Słowacki"),
    ("sv", "Swedish", "Szwedzki"),
    ("hr", "Croatian", "Chorwacki"),
    ("fil", "Filipino", "Filipiński"),
    ("hu", "Hungarian", "Węgierski"),
    ("no", "Norwegian", "Norweski"),
    ("sl", "Slovenian", "Słoweński"),
    ("ca", "Catalan", "Kataloński"),
    ("nn", "Nynorsk", "Nynorsk"),
    ("ta", "Tamil", "Tamilski"),
    ("af", "Afrikaans", "Afrikaans"),
    ("auto", "auto", "Auto-wykrywanie"),
];

pub const DEFAULT_MINIMAX_LANGUAGE: &str = "pl";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxEmotion {
    Happy,
    Sad,
    Angry,
    Fearful,
    Disgusted,
    Surprised,
    Calm,
    Fluent,
    Whisper,
}

impl MinimaxEmotion {
    pub fn as_api_str(&self) -> &'static str {
        match self {
            Self::Happy => "happy",
            Self::Sad => "sad",
            Self::Angry => "angry",
            Self::Fearful => "fearful",
            Self::Disgusted => "disgusted",
            Self::Surprised => "surprised",
            Self::Calm => "calm",
            Self::Fluent => "fluent",
            Self::Whisper => "whisper",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxSoundEffect {
    SpaciousEcho,
    AuditoriumEcho,
    LofiTelephone,
    Robotic,
}

impl MinimaxSoundEffect {
    pub fn as_api_str(&self) -> &'static str {
        match self {
            Self::SpaciousEcho => "spacious_echo",
            Self::AuditoriumEcho => "auditorium_echo",
            Self::LofiTelephone => "lofi_telephone",
            Self::Robotic => "robotic",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxSubtitleType {
    #[default]
    Sentence,
    Word,
    WordStreaming,
}

impl MinimaxSubtitleType {
    pub fn as_api_str(&self) -> &'static str {
        match self {
            Self::Sentence => "sentence",
            Self::Word => "word",
            Self::WordStreaming => "word_streaming",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxOutputFormat {
    #[default]
    Hex,
    Url,
}

impl MinimaxOutputFormat {
    pub fn as_api_str(&self) -> &'static str {
        match self {
            Self::Hex => "hex",
            Self::Url => "url",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxTransport {
    #[default]
    Websocket,
    Http,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MinimaxHttpRegion {
    #[default]
    Default,
    Uw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxTimbreWeight {
    pub voice_id: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MinimaxPronunciationDict {
    #[serde(default)]
    pub tone: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxVoiceModify {
    #[serde(default)]
    pub pitch: i32,
    #[serde(default)]
    pub intensity: i32,
    #[serde(default)]
    pub timbre: i32,
    #[serde(default)]
    pub sound_effects: Option<MinimaxSoundEffect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxAudioSettingOptions {
    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,
    #[serde(default = "default_bitrate")]
    pub bitrate: u32,
    #[serde(default = "default_audio_format")]
    pub format: String,
    #[serde(default = "default_channel")]
    pub channel: u32,
    #[serde(default)]
    pub force_cbr: bool,
}

fn default_sample_rate() -> u32 {
    32000
}
fn default_bitrate() -> u32 {
    128000
}
fn default_audio_format() -> String {
    "mp3".into()
}
fn default_channel() -> u32 {
    1
}

impl Default for MinimaxAudioSettingOptions {
    fn default() -> Self {
        Self {
            sample_rate: default_sample_rate(),
            bitrate: default_bitrate(),
            format: default_audio_format(),
            channel: default_channel(),
            force_cbr: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxVoiceSettingOptions {
    #[serde(default)]
    pub speed: f32,
    #[serde(default = "default_vol")]
    pub vol: f32,
    #[serde(default)]
    pub pitch: i32,
    #[serde(default)]
    pub emotion: Option<MinimaxEmotion>,
    #[serde(default)]
    pub english_normalization: bool,
    #[serde(default)]
    pub text_normalization: bool,
    #[serde(default)]
    pub latex_read: bool,
}

fn default_vol() -> f32 {
    1.0
}

impl Default for MinimaxVoiceSettingOptions {
    fn default() -> Self {
        Self {
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
            emotion: None,
            english_normalization: false,
            text_normalization: false,
            latex_read: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MinimaxStreamOptions {
    #[serde(default)]
    pub exclude_aggregated_audio: bool,
}

/// Full MiniMax T2A synthesis options (sync + async).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxSynthesisOptions {
    #[serde(default)]
    pub voice: MinimaxVoiceSettingOptions,
    #[serde(default)]
    pub audio: MinimaxAudioSettingOptions,
    #[serde(default)]
    pub voice_modify: Option<MinimaxVoiceModify>,
    #[serde(default)]
    pub pronunciation_dict: Option<MinimaxPronunciationDict>,
    #[serde(default)]
    pub timbre_weights: Vec<MinimaxTimbreWeight>,
    /// Hub language code (`pl`, `en`, …) or raw API value (`Polish`, `auto`).
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub subtitle_enable: bool,
    #[serde(default)]
    pub subtitle_type: MinimaxSubtitleType,
    #[serde(default)]
    pub continuous_sound: bool,
    #[serde(default)]
    pub output_format: MinimaxOutputFormat,
    #[serde(default)]
    pub transport: MinimaxTransport,
    #[serde(default)]
    pub http_region: MinimaxHttpRegion,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub stream_options: MinimaxStreamOptions,
    /// Async-only: uploaded text file id (txt/zip).
    #[serde(default)]
    pub text_file_id: Option<i64>,
}

impl Default for MinimaxSynthesisOptions {
    fn default() -> Self {
        Self {
            voice: MinimaxVoiceSettingOptions::default(),
            audio: MinimaxAudioSettingOptions::default(),
            voice_modify: None,
            pronunciation_dict: None,
            timbre_weights: Vec::new(),
            language: Some(DEFAULT_MINIMAX_LANGUAGE.to_string()),
            subtitle_enable: true,
            subtitle_type: MinimaxSubtitleType::Word,
            continuous_sound: false,
            output_format: MinimaxOutputFormat::default(),
            transport: MinimaxTransport::default(),
            http_region: MinimaxHttpRegion::default(),
            stream: false,
            stream_options: MinimaxStreamOptions::default(),
            text_file_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MinimaxCloneOptions {
    #[serde(default)]
    pub need_noise_reduction: bool,
    #[serde(default)]
    pub need_volume_normalization: bool,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxProviderSettings {
    #[serde(default)]
    pub default_synthesis: MinimaxSynthesisOptions,
}

impl Default for MinimaxProviderSettings {
    fn default() -> Self {
        Self {
            default_synthesis: MinimaxSynthesisOptions::default(),
        }
    }
}

pub fn is_known_language_code(code: &str) -> bool {
    let c = code.trim().to_ascii_lowercase();
    MINIMAX_LANGUAGE_CATALOG.iter().any(|(hub, _, _)| *hub == c)
}

pub fn language_boost_from_hub_or_api(code: Option<&str>) -> String {
    let raw = code.unwrap_or(DEFAULT_MINIMAX_LANGUAGE).trim();
    if raw.is_empty() {
        return "auto".to_string();
    }
    let lower = raw.to_ascii_lowercase();
    if let Some((_, boost, _)) = MINIMAX_LANGUAGE_CATALOG
        .iter()
        .find(|(hub, _, _)| *hub == lower)
    {
        return (*boost).to_string();
    }
    // Already an API value (Polish, auto, Chinese,Yue, …)
    raw.to_string()
}

pub fn normalize_enabled_language_codes(codes: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for code in codes {
        let c = code.trim().to_ascii_lowercase();
        if is_known_language_code(&c) && !out.iter().any(|x| x == &c) {
            out.push(c);
        }
    }
    if out.is_empty() {
        vec![DEFAULT_MINIMAX_LANGUAGE.to_string()]
    } else {
        out
    }
}

pub fn effective_enabled_language_codes(settings_codes: &[String]) -> Vec<String> {
    if settings_codes.is_empty() {
        MINIMAX_LANGUAGE_CATALOG
            .iter()
            .map(|(code, _, _)| (*code).to_string())
            .collect()
    } else {
        normalize_enabled_language_codes(settings_codes)
    }
}

pub fn model_supports_whisper(model: &str) -> bool {
    model.contains("2.6")
}

pub fn model_supports_continuous_sound(model: &str) -> bool {
    model.contains("2.8")
}

pub fn voice_modify_supported_format(fmt: &str) -> bool {
    matches!(
        fmt.trim().to_ascii_lowercase().as_str(),
        "mp3" | "wav" | "flac"
    )
}

pub fn validate_voice_id(voice_id: &str) -> Result<(), String> {
    let v = voice_id.trim();
    if v.len() < 8 || v.len() > 256 {
        return Err("voice_id: długość 8–256 znaków".into());
    }
    let first = v.chars().next().unwrap();
    if !first.is_ascii_alphabetic() {
        return Err("voice_id: musi zaczynać się od litery".into());
    }
    if v.ends_with('-') || v.ends_with('_') {
        return Err("voice_id: nie może kończyć się na - lub _".into());
    }
    if !v
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("voice_id: dozwolone litery, cyfry, - i _".into());
    }
    Ok(())
}

impl MinimaxSynthesisOptions {
    pub fn merge_legacy(speed: Option<f32>, vol: Option<f32>, pitch: Option<i32>) -> Self {
        let mut o = Self::default();
        if let Some(s) = speed {
            o.voice.speed = s;
        }
        if let Some(v) = vol {
            o.voice.vol = v;
        }
        if let Some(p) = pitch {
            o.voice.pitch = p;
        }
        o
    }

    pub fn resolve(&mut self, voice_id: &str, hub_format: &str, model: &str) {
        self.voice.speed = self.voice.speed.clamp(0.5, 2.0);
        self.voice.vol = self.voice.vol.clamp(0.0, 10.0);
        self.voice.pitch = self.voice.pitch.clamp(-12, 12);

        if self.voice.latex_read {
            self.language = Some("zh".to_string());
        }

        if self.timbre_weights.len() > 4 {
            self.timbre_weights.truncate(4);
        }
        for tw in &mut self.timbre_weights {
            tw.weight = tw.weight.clamp(1, 100);
        }

        if let Some(vm) = &mut self.voice_modify {
            vm.pitch = vm.pitch.clamp(-100, 100);
            vm.intensity = vm.intensity.clamp(-100, 100);
            vm.timbre = vm.timbre.clamp(-100, 100);
            if !voice_modify_supported_format(&self.audio.format) {
                *vm = MinimaxVoiceModify {
                    pitch: 0,
                    intensity: 0,
                    timbre: 0,
                    sound_effects: None,
                };
            }
        }

        if let Some(emotion) = &self.voice.emotion {
            if matches!(emotion, MinimaxEmotion::Whisper) && !model_supports_whisper(model) {
                self.voice.emotion = None;
            }
        }

        if !model_supports_continuous_sound(model) {
            self.continuous_sound = false;
        }

        // Map hub export format to API when user didn't customize audio.format
        if self.audio.format == "mp3" && hub_format != "mp3" {
            let hf = hub_format.trim().to_ascii_lowercase();
            if hf == "wav" || hf == "ogg" {
                // keep mp3 from API, ffmpeg converts on save
            }
        }

        let _ = voice_id; // timbre_weights may leave voice_id empty at API level
    }

    pub fn language_boost(&self) -> String {
        language_boost_from_hub_or_api(self.language.as_deref())
    }

    pub fn needs_http_transport(&self) -> bool {
        self.transport == MinimaxTransport::Http
            || self.output_format == MinimaxOutputFormat::Url
            || (self.subtitle_enable
                && self.subtitle_type == MinimaxSubtitleType::WordStreaming)
            || self.stream
    }

    pub fn api_voice_id(&self, primary_voice_id: &str) -> String {
        if !self.timbre_weights.is_empty() {
            String::new()
        } else {
            primary_voice_id.to_string()
        }
    }

    pub fn build_voice_setting_json(&self, voice_id: &str) -> serde_json::Value {
        let mut vs = serde_json::json!({
            "voice_id": self.api_voice_id(voice_id),
            "speed": self.voice.speed,
            "vol": self.voice.vol,
            "pitch": self.voice.pitch,
            "english_normalization": self.voice.english_normalization,
            "text_normalization": self.voice.text_normalization,
            "latex_read": self.voice.latex_read,
        });
        if let Some(emotion) = &self.voice.emotion {
            vs["emotion"] = serde_json::Value::String(emotion.as_api_str().to_string());
        }
        vs
    }

    pub fn build_audio_setting_json(&self) -> serde_json::Value {
        serde_json::json!({
            "sample_rate": self.audio.sample_rate,
            "bitrate": self.audio.bitrate,
            "format": normalize_api_format(&self.audio.format),
            "channel": self.audio.channel,
            "force_cbr": self.audio.force_cbr,
        })
    }

    pub fn append_optional_fields(&self, body: &mut serde_json::Map<String, serde_json::Value>) {
        let boost = self.language_boost();
        if !boost.is_empty() {
            body.insert("language_boost".into(), serde_json::Value::String(boost));
        }
        if let Some(pd) = &self.pronunciation_dict {
            if !pd.tone.is_empty() {
                body.insert(
                    "pronunciation_dict".into(),
                    serde_json::json!({ "tone": pd.tone }),
                );
            }
        }
        if !self.timbre_weights.is_empty() {
            let weights: Vec<serde_json::Value> = self
                .timbre_weights
                .iter()
                .map(|w| {
                    serde_json::json!({
                        "voice_id": w.voice_id,
                        "weight": w.weight,
                    })
                })
                .collect();
            body.insert("timbre_weights".into(), serde_json::Value::Array(weights));
        }
        if let Some(vm) = &self.voice_modify {
            let mut obj = serde_json::json!({
                "pitch": vm.pitch,
                "intensity": vm.intensity,
                "timbre": vm.timbre,
            });
            if let Some(se) = &vm.sound_effects {
                obj["sound_effects"] = serde_json::Value::String(se.as_api_str().to_string());
            }
            body.insert("voice_modify".into(), obj);
        }
        if self.subtitle_enable {
            body.insert("subtitle_enable".into(), serde_json::Value::Bool(true));
            body.insert(
                "subtitle_type".into(),
                serde_json::Value::String(self.subtitle_type.as_api_str().to_string()),
            );
        }
        if self.continuous_sound {
            body.insert("continuous_sound".into(), serde_json::Value::Bool(true));
        }
    }
}

pub fn normalize_api_format(fmt: &str) -> String {
    match fmt.trim().to_ascii_lowercase().as_str() {
        "pcm" => "pcm".into(),
        "flac" => "flac".into(),
        "wav" => "wav".into(),
        "opus" => "opus".into(),
        "pcmu_raw" => "pcmu_raw".into(),
        "pcmu_wav" => "pcmu_wav".into(),
        _ => "mp3".into(),
    }
}

pub fn t2a_http_base_url(region: &MinimaxHttpRegion) -> &'static str {
    match region {
        MinimaxHttpRegion::Uw => "https://api-uw.minimax.io/v1/t2a_v2",
        MinimaxHttpRegion::Default => "https://api.minimax.io/v1/t2a_v2",
    }
}

pub const SYNC_TEXT_CHAR_LIMIT: usize = 10_000;
