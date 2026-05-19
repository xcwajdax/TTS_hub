use anyhow::{anyhow, Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;

/// Fallback when the models API is unreachable.
pub const DEFAULT_TTS_MODELS: &[(&str, &str)] = &[
    ("gemini-3.1-flash-tts-preview", "Gemini 3.1 Flash TTS (Preview)"),
    ("gemini-2.5-flash-preview-tts", "Gemini 2.5 Flash Preview TTS"),
    ("gemini-2.5-pro-preview-tts", "Gemini 2.5 Pro Preview TTS"),
];

pub const VOICES: &[&str] = &[
    "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
    "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
    "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
    "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
    "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerConfig {
    pub speaker: String,
    pub voice: String,
}

#[derive(Debug, Clone)]
pub struct TtsRequest {
    pub model: String,
    pub text: String,
    pub voice: String,
    pub style: Option<String>,
    pub multi_speaker: Option<Vec<SpeakerConfig>>,
}

pub struct TtsResult {
    pub pcm_bytes: Vec<u8>,
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
}

#[derive(Debug, Serialize)]
struct GenContentReq<'a> {
    contents: Vec<Content<'a>>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Debug, Serialize)]
struct Content<'a> {
    parts: Vec<Part<'a>>,
}

#[derive(Debug, Serialize)]
struct Part<'a> {
    text: &'a str,
}

#[derive(Debug, Serialize)]
struct GenerationConfig {
    #[serde(rename = "responseModalities")]
    response_modalities: Vec<String>,
    #[serde(rename = "speechConfig")]
    speech_config: SpeechConfig,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum SpeechConfig {
    Single {
        #[serde(rename = "voiceConfig")]
        voice_config: VoiceConfig,
    },
    Multi {
        #[serde(rename = "multiSpeakerVoiceConfig")]
        multi_speaker_voice_config: MultiSpeakerVoiceConfig,
    },
}

#[derive(Debug, Serialize)]
struct VoiceConfig {
    #[serde(rename = "prebuiltVoiceConfig")]
    prebuilt_voice_config: PrebuiltVoiceConfig,
}

#[derive(Debug, Serialize)]
struct PrebuiltVoiceConfig {
    #[serde(rename = "voiceName")]
    voice_name: String,
}

#[derive(Debug, Serialize)]
struct MultiSpeakerVoiceConfig {
    #[serde(rename = "speakerVoiceConfigs")]
    speaker_voice_configs: Vec<SpeakerVoiceConfig>,
}

#[derive(Debug, Serialize)]
struct SpeakerVoiceConfig {
    speaker: String,
    #[serde(rename = "voiceConfig")]
    voice_config: VoiceConfig,
}

#[derive(Debug, Deserialize)]
struct GenContentRes {
    candidates: Option<Vec<Candidate>>,
    #[serde(default)]
    error: Option<ApiError>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Option<ContentRes>,
}

#[derive(Debug, Deserialize)]
struct ContentRes {
    parts: Option<Vec<PartRes>>,
}

#[derive(Debug, Deserialize)]
struct PartRes {
    #[serde(rename = "inlineData")]
    inline_data: Option<InlineData>,
}

#[derive(Debug, Deserialize)]
struct InlineData {
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: String,
    #[allow(dead_code)]
    code: Option<i32>,
    #[allow(dead_code)]
    status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TtsModelInfo {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
struct ListModelsRes {
    models: Option<Vec<ModelEntry>>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

pub struct GoogleTts {
    api_key: RwLock<String>,
    client: reqwest::Client,
}

impl GoogleTts {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key: RwLock::new(api_key),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("reqwest client"),
        }
    }

    pub fn set_api_key(&self, key: String) {
        if let Ok(mut guard) = self.api_key.write() {
            *guard = key;
        }
    }

    fn current_api_key(&self) -> String {
        self.api_key
            .read()
            .map(|k| k.clone())
            .unwrap_or_default()
    }

    pub async fn list_tts_models(&self) -> Result<Vec<TtsModelInfo>> {
        let api_key = self.current_api_key();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            api_key
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("HTTP request to list Google models failed")?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Ok(default_model_list());
        }
        let parsed: ListModelsRes = match serde_json::from_str(&text) {
            Ok(p) => p,
            Err(_) => return Ok(default_model_list()),
        };
        let mut models: Vec<TtsModelInfo> = parsed
            .models
            .unwrap_or_default()
            .into_iter()
            .filter_map(|m| {
                let id = m.name.strip_prefix("models/")?.to_string();
                if !id.contains("tts") {
                    return None;
                }
                Some(TtsModelInfo {
                    display_name: m.display_name.unwrap_or_else(|| id.clone()),
                    id,
                })
            })
            .collect();
        if models.is_empty() {
            return Ok(default_model_list());
        }
        models.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(models)
    }

    pub async fn synthesize(&self, req: &TtsRequest) -> Result<TtsResult> {
        let final_text = build_tts_content(req);

        let speech_config = if let Some(speakers) = &req.multi_speaker {
            SpeechConfig::Multi {
                multi_speaker_voice_config: MultiSpeakerVoiceConfig {
                    speaker_voice_configs: speakers
                        .iter()
                        .map(|s| SpeakerVoiceConfig {
                            speaker: s.speaker.clone(),
                            voice_config: VoiceConfig {
                                prebuilt_voice_config: PrebuiltVoiceConfig {
                                    voice_name: s.voice.clone(),
                                },
                            },
                        })
                        .collect(),
                },
            }
        } else {
            SpeechConfig::Single {
                voice_config: VoiceConfig {
                    prebuilt_voice_config: PrebuiltVoiceConfig {
                        voice_name: req.voice.clone(),
                    },
                },
            }
        };

        let body = GenContentReq {
            contents: vec![Content { parts: vec![Part { text: &final_text }] }],
            generation_config: GenerationConfig {
                response_modalities: vec!["AUDIO".to_string()],
                speech_config,
            },
        };

        let api_key = self.current_api_key();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            req.model, api_key
        );

        let resp = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("HTTP request to Google failed")?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(anyhow!("Google API HTTP {}: {}", status, truncate(&text, 500)));
        }

        let parsed: GenContentRes = serde_json::from_str(&text)
            .with_context(|| format!("invalid JSON from Google: {}", truncate(&text, 300)))?;

        if let Some(err) = parsed.error {
            return Err(anyhow!("Google API error: {}", err.message));
        }

        let inline = parsed
            .candidates
            .and_then(|mut c| c.pop())
            .and_then(|c| c.content)
            .and_then(|c| c.parts)
            .and_then(|mut p| p.pop())
            .and_then(|p| p.inline_data)
            .ok_or_else(|| anyhow!("no audio data in response: {}", truncate(&text, 300)))?;

        let pcm = base64::engine::general_purpose::STANDARD
            .decode(&inline.data)
            .context("invalid base64 audio")?;

        let (sample_rate, channels, bits_per_sample) = parse_audio_mime(&inline.mime_type);

        Ok(TtsResult {
            pcm_bytes: pcm,
            sample_rate,
            channels,
            bits_per_sample,
        })
    }
}

fn parse_audio_mime(mime: &str) -> (u32, u16, u16) {
    let mut rate = 24_000u32;
    let mut bits = 16u16;
    for part in mime.split(';').map(str::trim) {
        if let Some(rest) = part.strip_prefix("rate=") {
            if let Ok(v) = rest.trim().parse::<u32>() {
                rate = v;
            }
        }
        if let Some(rest) = part.strip_prefix("codec=pcm") {
            if let Some(b) = rest.strip_prefix("L") {
                if let Ok(v) = b.parse::<u16>() {
                    bits = v;
                }
            }
        }
        if part.starts_with("audio/L") {
            if let Some(b) = part.trim_start_matches("audio/L").split(';').next() {
                if let Ok(v) = b.parse::<u16>() {
                    bits = v;
                }
            }
        }
    }
    (rate, 1, bits)
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n { s.to_string() } else { format!("{}...", &s[..n]) }
}

fn default_model_list() -> Vec<TtsModelInfo> {
    DEFAULT_TTS_MODELS
        .iter()
        .map(|(id, name)| TtsModelInfo {
            id: (*id).to_string(),
            display_name: (*name).to_string(),
        })
        .collect()
}

/// Gemini TTS models only emit audio when the prompt clearly requests speech synthesis.
fn build_tts_content(req: &TtsRequest) -> String {
    let text = req.text.trim();
    let style = req
        .style
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    let multi = req.multi_speaker.is_some();

    let body = match style {
        Some(s) => format!("{s}\n\n{text}"),
        None => text.to_string(),
    };

    if multi {
        if looks_like_tts_instruction(&body) {
            return body;
        }
        return format!("TTS the following conversation:\n\n{body}");
    }

    if style.is_some() || looks_like_tts_instruction(text) {
        return body;
    }

    format!("Say:\n\n{text}")
}

fn looks_like_tts_instruction(text: &str) -> bool {
    let lower = text.to_lowercase();
    [
        "say ", "say:", "read ", "read aloud", "tts ", "speak ", "powiedz", "przeczytaj",
        "make ", "narrat",
    ]
    .iter()
    .any(|p| lower.starts_with(p))
        || text.contains("Speaker")
        || text.contains("Mowca")
        || text.contains("Mówca")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(text: &str, style: Option<&str>, multi: bool) -> TtsRequest {
        TtsRequest {
            model: "gemini-2.5-flash-preview-tts".into(),
            text: text.into(),
            voice: "Kore".into(),
            style: style.map(str::to_string),
            multi_speaker: if multi {
                Some(vec![SpeakerConfig {
                    speaker: "A".into(),
                    voice: "Kore".into(),
                }])
            } else {
                None
            },
        }
    }

    #[test]
    fn multi_speaker_gets_tts_prefix() {
        let out = build_tts_content(&req("A: hi\nB: hey", None, true));
        assert!(out.starts_with("TTS the following conversation:"));
    }

    #[test]
    fn plain_text_gets_say_prefix() {
        let out = build_tts_content(&req("Hello world", None, false));
        assert!(out.starts_with("Say:"));
    }
}
