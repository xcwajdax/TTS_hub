use anyhow::{anyhow, Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio_tungstenite::{
    connect_async,
    tungstenite::client::IntoClientRequest,
    tungstenite::Message,
};

const WS_URL: &str = "wss://api.minimax.io/ws/v1/t2a_v2";
const UPLOAD_URL: &str = "https://api.minimax.io/v1/files/upload";
const CLONE_URL: &str = "https://api.minimax.io/v1/voice_clone";
const GET_VOICE_URL: &str = "https://api.minimax.io/v1/get_voice";

// IMPORTANT (verified 2026-06-07 against platform.minimax.io/docs):
// MiniMax API does NOT expose any endpoint to check quota, usage, balance, or
// token consumption. Confirmed 404s for /v1/query_account, /v1/account,
// /v1/account/quota, /v1/usage, /v1/quota, /v1/user_info, /v1/billing,
// /v1/balance, /v1/get_quota, /v1/get_account_info, /v1/t2a_v2/query_account,
// /v1/t2a_v2/quota — all return 404 even with valid Authorization header.
//
// Reason: MiniMax retired the per-product quota model. There is no longer a
// "speech quota" — all products (T2A, LLM, video, image, music) draw from a
// single shared token pool visible only in the platform.minimax.io dashboard.
// The /v1/get_voice endpoint returns `voice_slots` (cloned-voice count) but
// no account/token-pool info. The /v1/t2a_v2 HTTP endpoint returns audio
// with NO X-RateLimit-* or X-Quota-* headers — only generic AWS ALB headers
// (alb_receive_time, alb_request_id, Trace-Id) and Minimax-Request-Id.
//
// The only API-level limits documented are RPM/TPM (per-minute), shown at
// https://platform.minimax.io/docs/guides/rate-limits. For T2A speech-2.8
// series the limit is 60 RPM. These are NOT daily quotas and NOT a token
// pool — they reset every rolling minute.
//
// If we want a visible "remaining usage" indicator in the TTShub UI, the
// only honest options are:
//   (1) log into platform.minimax.io dashboard (out of TTShub's scope),
//   (2) add a local counter that tracks tokens we sent ourselves
//       (an estimate, not the truth — does not count usage from other tools),
//   (3) try-and-see: fire a tiny request and report the error if MiniMax
//       returns 429 (cost: 1 token per check).
//
// Earlier (pre-2026-06-07) docs/skill notes that quoted "4000 tokens/day,
// reset 22:00 CET" were WRONG — that number was the OLD per-product speech
// quota which MiniMax retired when they moved to a shared token pool.
// Local per-provider usage counter is now in src-tauri/src/usage.rs; /usage HTTP endpoint.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxHealth {
    pub configured: bool,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxModelInfo {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxLanguageInfo {
    /// Hub code, e.g. `pl`, `en`.
    pub code: String,
    /// MiniMax API `language_boost` value, e.g. `Polish`.
    pub language_boost: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxPresetVoice {
    pub voice_id: String,
    pub display_name: String,
    /// Hub language code (`pl`, `en`, …).
    pub language: String,
}

pub const DEFAULT_MINIMAX_LANGUAGE: &str = "pl";
pub const DEFAULT_MINIMAX_VOICE_ID: &str = "Polish_female_1_sample1";

const MINIMAX_LANGUAGES: &[(&str, &str, &str)] = &[
    ("pl", "Polish", "Polski"),
    ("en", "English", "Angielski"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxClonedVoice {
    pub voice_id: String,
    pub name: String,
    pub created_at: i64,
    /// Mnożnik głośności klonu (0–10), stosowany do presetowego `minimax_vol` przy syntezie.
    #[serde(default)]
    pub output_vol: Option<f32>,
}

impl MinimaxClonedVoice {
    /// `preset_vol` × mnożnik klonu (domyślnie 1.0), wynik w zakresie 0–10.
    pub fn effective_minimax_vol(cloned: &[Self], voice_id: &str, preset_vol: f32) -> f32 {
        let base = preset_vol.clamp(0.0, 10.0);
        let mult = cloned
            .iter()
            .find(|v| v.voice_id == voice_id)
            .and_then(|v| v.output_vol)
            .unwrap_or(1.0)
            .clamp(0.0, 10.0);
        (base * mult).clamp(0.0, 10.0)
    }

    pub fn normalize_output_vol(&mut self) {
        if let Some(v) = self.output_vol {
            self.output_vol = Some(v.clamp(0.0, 10.0));
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxSyncVoicesResult {
    pub system_count: usize,
    pub cloning_count: usize,
    pub generation_count: usize,
    pub synced_at: i64,
}

#[derive(Debug, Deserialize)]
struct GetVoiceResponse {
    #[serde(default)]
    system_voice: Vec<SystemVoiceApi>,
    #[serde(default)]
    voice_cloning: Vec<VoiceCloningApi>,
    #[serde(default)]
    voice_generation: Vec<VoiceGenerationApi>,
    #[serde(default)]
    base_resp: Option<BaseRespApi>,
}

#[derive(Debug, Deserialize)]
struct SystemVoiceApi {
    voice_id: String,
    #[serde(default)]
    voice_name: Option<String>,
    #[serde(default)]
    description: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct VoiceCloningApi {
    voice_id: String,
    #[serde(default)]
    description: Vec<String>,
    #[serde(default)]
    created_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VoiceGenerationApi {
    voice_id: String,
    #[serde(default)]
    description: Vec<String>,
    #[serde(default)]
    created_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BaseRespApi {
    status_code: Option<i64>,
    #[serde(default)]
    status_msg: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxVoiceSetting {
    pub voice_id: String,
    #[serde(default = "default_speed")]
    pub speed: f32,
    #[serde(default = "default_vol")]
    pub vol: f32,
    #[serde(default)]
    pub pitch: i32,
    #[serde(default)]
    pub english_normalization: bool,
}

fn default_speed() -> f32 {
    1.0
}
fn default_vol() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize)]
pub struct MinimaxGenerateParams<'a> {
    pub model: &'a str,
    pub text: &'a str,
    pub voice: &'a MinimaxVoiceSetting,
    pub format: &'a str,
    /// MiniMax API `language_boost` (e.g. `Polish`, `English`, `auto`).
    pub language_boost: Option<&'a str>,
}

pub struct MinimaxAudio {
    pub bytes: Vec<u8>,
    pub format: String,
}

pub struct MinimaxClient {
    api_key: Arc<RwLock<String>>,
    http: reqwest::Client,
}

impl MinimaxClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key: Arc::new(RwLock::new(api_key)),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(180))
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
            .map(|g| g.clone())
            .unwrap_or_default()
    }

    pub fn is_configured(&self) -> bool {
        !self.current_api_key().trim().is_empty()
    }

    pub fn list_models() -> Vec<MinimaxModelInfo> {
        vec![
            MinimaxModelInfo {
                id: "speech-2.8-hd".into(),
                display_name: "Speech 2.8 HD".into(),
            },
            MinimaxModelInfo {
                id: "speech-2.8-turbo".into(),
                display_name: "Speech 2.8 Turbo".into(),
            },
            MinimaxModelInfo {
                id: "speech-2.6-hd".into(),
                display_name: "Speech 2.6 HD".into(),
            },
            MinimaxModelInfo {
                id: "speech-2.6-turbo".into(),
                display_name: "Speech 2.6 Turbo".into(),
            },
            MinimaxModelInfo {
                id: "speech-02-hd".into(),
                display_name: "Speech 02 HD".into(),
            },
            MinimaxModelInfo {
                id: "speech-02-turbo".into(),
                display_name: "Speech 02 Turbo".into(),
            },
        ]
    }

    pub fn list_languages() -> Vec<MinimaxLanguageInfo> {
        MINIMAX_LANGUAGES
            .iter()
            .map(|(code, boost, label)| MinimaxLanguageInfo {
                code: (*code).to_string(),
                language_boost: (*boost).to_string(),
                display_name: (*label).to_string(),
            })
            .collect()
    }

    pub fn preset_voices() -> Vec<MinimaxPresetVoice> {
        vec![
            MinimaxPresetVoice {
                voice_id: "Polish_male_1_sample4".into(),
                display_name: "Polski — narrator (m)".into(),
                language: "pl".into(),
            },
            MinimaxPresetVoice {
                voice_id: "Polish_male_2_sample3".into(),
                display_name: "Polski — anchor (m)".into(),
                language: "pl".into(),
            },
            MinimaxPresetVoice {
                voice_id: "Polish_female_1_sample1".into(),
                display_name: "Polski — spokojna (k)".into(),
                language: "pl".into(),
            },
            MinimaxPresetVoice {
                voice_id: "Polish_female_2_sample3".into(),
                display_name: "Polski — swobodna (k)".into(),
                language: "pl".into(),
            },
            MinimaxPresetVoice {
                voice_id: "English_expressive_narrator".into(),
                display_name: "English expressive narrator".into(),
                language: "en".into(),
            },
            MinimaxPresetVoice {
                voice_id: "English_calm_female".into(),
                display_name: "English calm female".into(),
                language: "en".into(),
            },
            MinimaxPresetVoice {
                voice_id: "English_confident_male".into(),
                display_name: "English confident male".into(),
                language: "en".into(),
            },
        ]
    }

    pub fn preset_voices_filtered(
        voices: &[MinimaxPresetVoice],
        enabled_language_codes: &[String],
    ) -> Vec<MinimaxPresetVoice> {
        if enabled_language_codes.is_empty() {
            return voices.to_vec();
        }
        let allowed: std::collections::HashSet<String> = enabled_language_codes
            .iter()
            .map(|c| c.trim().to_ascii_lowercase())
            .filter(|c| is_known_language_code(c))
            .collect();
        if allowed.is_empty() {
            return voices
                .iter()
                .filter(|v| v.language == DEFAULT_MINIMAX_LANGUAGE)
                .cloned()
                .collect();
        }
        voices
            .iter()
            .filter(|v| allowed.contains(&v.language))
            .cloned()
            .collect()
    }

    pub fn effective_preset_voices(
        synced: &[MinimaxPresetVoice],
        enabled_language_codes: &[String],
    ) -> Vec<MinimaxPresetVoice> {
        let source = if synced.is_empty() {
            Self::preset_voices()
        } else {
            synced.to_vec()
        };
        Self::preset_voices_filtered(&source, enabled_language_codes)
    }

    /// Maps hub language code from MiniMax `voice_id` / `voice_name` heuristics.
    pub fn infer_language_from_voice_id(voice_id: &str) -> String {
        let v = voice_id.trim();
        let lower = v.to_ascii_lowercase();
        if v.starts_with("Polish") || lower.contains("polish") {
            return "pl".to_string();
        }
        if v.starts_with("English") || lower.contains("english") {
            return "en".to_string();
        }
        if v.starts_with("Chinese") || lower.contains("mandarin") || lower.contains("cantonese") {
            return "zh".to_string();
        }
        "other".to_string()
    }

    fn system_voice_display_name(v: &SystemVoiceApi) -> String {
        if let Some(name) = v.voice_name.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            return name.to_string();
        }
        v.voice_id.clone()
    }

    fn description_snippet(parts: &[String]) -> Option<String> {
        let text = parts
            .iter()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        if text.is_empty() {
            None
        } else {
            let short: String = text.chars().take(80).collect();
            if text.chars().count() > 80 {
                Some(format!("{short}…"))
            } else {
                Some(short)
            }
        }
    }

    fn parse_created_timestamp(created_time: Option<&str>) -> i64 {
        let Some(raw) = created_time.map(str::trim).filter(|s| !s.is_empty()) else {
            return chrono::Utc::now().timestamp();
        };
        if let Ok(dt) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
            return dt.and_hms_opt(0, 0, 0).map(|t| t.and_utc().timestamp()).unwrap_or_else(|| chrono::Utc::now().timestamp());
        }
        chrono::Utc::now().timestamp()
    }

    pub fn map_api_voices(resp: GetVoiceResponse) -> (Vec<MinimaxPresetVoice>, Vec<MinimaxClonedVoice>) {
        let mut presets: Vec<MinimaxPresetVoice> = resp
            .system_voice
            .into_iter()
            .map(|v| {
                let language = Self::infer_language_from_voice_id(&v.voice_id);
                let mut display_name = Self::system_voice_display_name(&v);
                if let Some(desc) = Self::description_snippet(&v.description) {
                    display_name = format!("{display_name} — {desc}");
                }
                MinimaxPresetVoice {
                    voice_id: v.voice_id,
                    display_name,
                    language,
                }
            })
            .collect();
        presets.sort_by(|a, b| {
            a.language
                .cmp(&b.language)
                .then(a.display_name.cmp(&b.display_name))
        });

        let mut cloned: Vec<MinimaxClonedVoice> = Vec::new();
        for v in resp.voice_cloning {
            let name = Self::description_snippet(&v.description)
                .unwrap_or_else(|| v.voice_id.clone());
            cloned.push(MinimaxClonedVoice {
                voice_id: v.voice_id,
                name,
                created_at: Self::parse_created_timestamp(v.created_time.as_deref()),
                output_vol: None,
            });
        }
        for v in resp.voice_generation {
            let name = Self::description_snippet(&v.description)
                .unwrap_or_else(|| format!("{} (gen)", v.voice_id));
            cloned.push(MinimaxClonedVoice {
                voice_id: v.voice_id,
                name,
                created_at: Self::parse_created_timestamp(v.created_time.as_deref()),
                output_vol: None,
            });
        }
        cloned.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        (presets, cloned)
    }

    pub async fn fetch_voices(&self, voice_type: &str) -> Result<GetVoiceResponse> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let resp = self
            .http
            .post(GET_VOICE_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "voice_type": voice_type }))
            .send()
            .await
            .context("get_voice request")?;
        let status = resp.status();
        let body: GetVoiceResponse = resp.json().await.context("get_voice json")?;
        if let Some(code) = body.base_resp.as_ref().and_then(|b| b.status_code) {
            if code != 0 {
                let msg = body
                    .base_resp
                    .as_ref()
                    .and_then(|b| b.status_msg.as_deref())
                    .unwrap_or("unknown error");
                return Err(anyhow!("Minimax get_voice error ({code}): {msg}"));
            }
        }
        if !status.is_success() {
            return Err(anyhow!("Minimax get_voice failed ({status})"));
        }
        Ok(body)
    }

    /// Preset catalog entry or cloned voice present on the MiniMax account.
    pub async fn voice_exists_on_account(
        &self,
        voice_id: &str,
        preset_voices: &[MinimaxPresetVoice],
    ) -> Result<bool> {
        let id = voice_id.trim();
        if id.is_empty() {
            return Ok(false);
        }
        if preset_voices.iter().any(|v| v.voice_id == id) {
            return Ok(true);
        }
        let resp = self.fetch_voices("all").await?;
        let (_, cloned) = Self::map_api_voices(resp);
        Ok(cloned.iter().any(|v| v.voice_id == id))
    }

    pub async fn sync_voices_from_api(&self) -> Result<(Vec<MinimaxPresetVoice>, Vec<MinimaxClonedVoice>, MinimaxSyncVoicesResult)> {
        let resp = self.fetch_voices("all").await?;
        let system_count = resp.system_voice.len();
        let cloning_count = resp.voice_cloning.len();
        let generation_count = resp.voice_generation.len();
        let (presets, cloned) = Self::map_api_voices(resp);
        let synced_at = chrono::Utc::now().timestamp();
        Ok((
            presets,
            cloned,
            MinimaxSyncVoicesResult {
                system_count,
                cloning_count,
                generation_count,
                synced_at,
            },
        ))
    }

    pub fn default_voice_for_language(language_code: &str) -> &'static str {
        match language_code.trim().to_ascii_lowercase().as_str() {
            "en" => "English_expressive_narrator",
            _ => DEFAULT_MINIMAX_VOICE_ID,
        }
    }

    pub async fn health(&self) -> MinimaxHealth {
        if !self.is_configured() {
            return MinimaxHealth {
                configured: false,
                ok: false,
                message: "Ustaw MINIMAX_API_KEY w studios.env lub w ustawieniach aplikacji".into(),
            };
        }
        MinimaxHealth {
            configured: true,
            ok: true,
            message: "Klucz API skonfigurowany (użyj Testuj w Szybkiej konfiguracji dla pełnego testu WS).".into(),
        }
    }

    /// WebSocket handshake only — no audio synthesis.
    pub async fn probe_connection(&self) -> Result<()> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let api_key = self.current_api_key();
        let mut request = WS_URL.into_client_request().context("ws request")?;
        request.headers_mut().insert(
            "Authorization",
            format!("Bearer {}", api_key).parse().context("auth header")?,
        );
        let (ws, _) = connect_async(request)
            .await
            .context("MiniMax WebSocket connect failed")?;
        let (_write, mut read) = ws.split();
        let connected = recv_json(&mut read).await?;
        if connected.get("event").and_then(|v| v.as_str()) == Some("connected_success") {
            Ok(())
        } else {
            Err(anyhow!("MiniMax connection failed: {}", connected))
        }
    }

    pub async fn generate_audio(&self, params: MinimaxGenerateParams<'_>) -> Result<MinimaxAudio> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let format = normalize_format(params.format);
        let sample_rate = 32000u32;
        let bitrate = 128000u32;

        let mut request = WS_URL.into_client_request().context("ws request")?;
        request
            .headers_mut()
            .insert(
                "Authorization",
                format!("Bearer {}", self.current_api_key()).parse().context("auth header")?,
            );

        let (ws, _) = connect_async(request)
            .await
            .context("Minimax WebSocket connect failed")?;
        let (mut write, mut read) = ws.split();

        let connected = recv_json(&mut read).await?;
        if connected.get("event").and_then(|v| v.as_str()) == Some("task_failed") {
            return Err(anyhow!(
                "Minimax connection failed: {}",
                minimax_error_message(&connected)
            ));
        }
        if connected.get("event").and_then(|v| v.as_str()) != Some("connected_success") {
            return Err(anyhow!(
                "Minimax connection failed: {}",
                minimax_error_message(&connected)
            ));
        }

        let mut start_msg = serde_json::json!({
            "event": "task_start",
            "model": params.model,
            "voice_setting": {
                "voice_id": params.voice.voice_id,
                "speed": params.voice.speed,
                "vol": params.voice.vol,
                "pitch": params.voice.pitch,
                "english_normalization": params.voice.english_normalization,
            },
            "audio_setting": {
                "sample_rate": sample_rate,
                "bitrate": bitrate,
                "format": format,
                "channel": 1,
            }
        });
        if let Some(boost) = params
            .language_boost
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            start_msg["language_boost"] = serde_json::Value::String(boost.to_string());
        }
        write
            .send(Message::Text(start_msg.to_string()))
            .await
            .context("task_start send")?;
        let started = recv_json(&mut read).await?;
        if started.get("event").and_then(|v| v.as_str()) == Some("task_failed") {
            return Err(anyhow!(
                "Minimax task_start failed: {}",
                minimax_error_message(&started)
            ));
        }
        if started.get("event").and_then(|v| v.as_str()) != Some("task_started") {
            return Err(anyhow!(
                "Minimax task_start failed: {}",
                minimax_error_message(&started)
            ));
        }

        let continue_msg = serde_json::json!({
            "event": "task_continue",
            "text": params.text,
        });
        write
            .send(Message::Text(continue_msg.to_string()))
            .await
            .context("task_continue send")?;

        let mut audio_data = Vec::new();
        loop {
            let msg = read
                .next()
                .await
                .ok_or_else(|| anyhow!("Minimax stream ended before completion"))??;
            if !msg.is_text() {
                continue;
            }
            let response: serde_json::Value =
                serde_json::from_str(msg.to_text()?).context("parse ws json")?;

            if let Some(event) = response.get("event").and_then(|v| v.as_str()) {
                if event == "task_failed" {
                    return Err(anyhow!("Minimax task failed: {}", minimax_error_message(&response)));
                }
                if event == "task_finished" {
                    break;
                }
            }

            if let Some(code) = response
                .pointer("/base_resp/status_code")
                .and_then(|v| v.as_i64())
            {
                if code != 0 {
                    return Err(anyhow!(
                        "Minimax API error ({code}): {}",
                        minimax_error_message(&response)
                    ));
                }
            }

            if let Some(hex) = response
                .pointer("/data/audio")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                let chunk = hex::decode(hex).context("decode audio hex")?;
                audio_data.extend_from_slice(&chunk);
            }

            if response.get("is_final").and_then(|v| v.as_bool()) == Some(true) {
                break;
            }
        }

        let _ = write
            .send(Message::Text(
                serde_json::json!({ "event": "task_finish" }).to_string(),
            ))
            .await;

        if audio_data.is_empty() {
            return Err(anyhow!("Minimax returned no audio data"));
        }

        Ok(MinimaxAudio {
            bytes: audio_data,
            format: format.to_string(),
        })
    }

    pub async fn upload_voice_file(
        &self,
        purpose: &str,
        filename: &str,
        bytes: Vec<u8>,
    ) -> Result<i64> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(filename.to_string())
            .mime_str("audio/mpeg")
            .context("mime")?;
        let form = reqwest::multipart::Form::new()
            .text("purpose", purpose.to_string())
            .part("file", part);

        let resp = self
            .http
            .post(UPLOAD_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .multipart(form)
            .send()
            .await
            .context("upload request")?;
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.context("upload json")?;
        if !status.is_success() {
            return Err(anyhow!("Minimax upload failed ({status}): {body}"));
        }
        body.pointer("/file/file_id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow!("missing file_id in response: {body}"))
    }

    pub async fn clone_voice(
        &self,
        file_id: i64,
        voice_id: &str,
        model: &str,
        preview_text: &str,
        prompt_file_id: Option<i64>,
        prompt_text: Option<&str>,
    ) -> Result<serde_json::Value> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let mut payload = serde_json::json!({
            "file_id": file_id,
            "voice_id": voice_id,
            "text": preview_text,
            "model": model,
        });
        if let Some(pid) = prompt_file_id {
            let mut clone_prompt = serde_json::json!({ "prompt_audio": pid });
            if let Some(t) = prompt_text.filter(|s| !s.trim().is_empty()) {
                clone_prompt["prompt_text"] = serde_json::Value::String(t.to_string());
            }
            payload["clone_prompt"] = clone_prompt;
        }

        let resp = self
            .http
            .post(CLONE_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .context("clone request")?;
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.context("clone json")?;
        if !status.is_success() {
            return Err(anyhow!("Minimax voice_clone failed ({status}): {body}"));
        }
        Ok(body)
    }
}

/// MiniMax WS accepts mp3, pcm, or flac — not wav/ogg. Hub may still export wav via ffmpeg.
fn normalize_format(fmt: &str) -> &'static str {
    match fmt.trim().to_ascii_lowercase().as_str() {
        "pcm" => "pcm",
        "flac" => "flac",
        _ => "mp3",
    }
}

fn minimax_error_message(response: &serde_json::Value) -> String {
    let raw = response
        .pointer("/base_resp/status_msg")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| response.to_string());
    if raw.to_ascii_lowercase().contains("voice id not exist") {
        return format!(
            "{raw} — ten voice_id nie ma na koncie MiniMax. \
             Użyj „Synchronizuj głosy z API” lub sklonuj głos ponownie („Stwórz głos”)."
        );
    }
    raw
}

async fn recv_json(
    read: &mut (impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin),
) -> Result<serde_json::Value> {
    loop {
        let msg = read
            .next()
            .await
            .ok_or_else(|| anyhow!("stream closed"))??;
        if msg.is_text() {
            return serde_json::from_str(msg.to_text()?).context("json");
        }
    }
}

pub fn model_from_id(model: &str) -> &str {
    model
        .strip_prefix("minimax:")
        .unwrap_or(model)
}

pub fn is_known_language_code(code: &str) -> bool {
    let c = code.trim().to_ascii_lowercase();
    MINIMAX_LANGUAGES.iter().any(|(hub, _, _)| *hub == c)
}

/// Maps hub language code (`pl`, `en`) to MiniMax `language_boost` API value.
pub fn hub_language_to_boost(code: Option<&str>) -> &'static str {
    let c = code.unwrap_or(DEFAULT_MINIMAX_LANGUAGE).trim().to_ascii_lowercase();
    MINIMAX_LANGUAGES
        .iter()
        .find(|(hub, _, _)| *hub == c)
        .map(|(_, boost, _)| *boost)
        .unwrap_or("auto")
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
        MINIMAX_LANGUAGES
            .iter()
            .map(|(code, _, _)| (*code).to_string())
            .collect()
    } else {
        normalize_enabled_language_codes(settings_codes)
    }
}
