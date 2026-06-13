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

pub use crate::minimax_options::{
    effective_enabled_language_codes, is_known_language_code, MinimaxCloneOptions,
    MinimaxProviderSettings, MinimaxSynthesisOptions, DEFAULT_MINIMAX_LANGUAGE,
    MINIMAX_LANGUAGE_CATALOG,
};

use crate::minimax_options::{
    language_boost_from_hub_or_api, normalize_api_format, t2a_http_base_url, validate_voice_id,
    MinimaxOutputFormat, SYNC_TEXT_CHAR_LIMIT,
};

const WS_URL: &str = "wss://api.minimax.io/ws/v1/t2a_v2";
const UPLOAD_URL: &str = "https://api.minimax.io/v1/files/upload";
const CLONE_URL: &str = "https://api.minimax.io/v1/voice_clone";
const GET_VOICE_URL: &str = "https://api.minimax.io/v1/get_voice";
const VOICE_DESIGN_URL: &str = "https://api.minimax.io/v1/voice_design";
const DELETE_VOICE_URL: &str = "https://api.minimax.io/v1/delete_voice";
const T2A_ASYNC_URL: &str = "https://api.minimax.io/v1/t2a_async_v2";
const T2A_ASYNC_QUERY_URL: &str = "https://api.minimax.io/v1/t2a_async_v2";
const FILE_RETRIEVE_URL: &str = "https://api.minimax.io/v1/files/retrieve";
const FILE_RETRIEVE_CONTENT_URL: &str = "https://api.minimax.io/v1/files/retrieve_content";

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

pub const DEFAULT_MINIMAX_VOICE_ID: &str = "Polish_female_1_sample1";

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
pub(crate) struct GetVoiceResponse {
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

#[derive(Debug, Clone, Serialize)]
pub struct MinimaxGenerateParams<'a> {
    pub model: &'a str,
    pub text: &'a str,
    pub voice_id: &'a str,
    pub hub_format: &'a str,
    pub options: &'a MinimaxSynthesisOptions,
}

pub struct MinimaxAudio {
    pub bytes: Vec<u8>,
    pub format: String,
    pub subtitle_bytes: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxVoiceDesignResult {
    pub voice_id: String,
    pub trial_audio_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxCloneResult {
    pub demo_audio_url: Option<String>,
    pub usage_characters: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxAsyncTaskResult {
    pub task_id: String,
    pub file_id: Option<i64>,
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
            MinimaxModelInfo {
                id: "speech-01-hd".into(),
                display_name: "Speech 01 HD".into(),
            },
            MinimaxModelInfo {
                id: "speech-01-turbo".into(),
                display_name: "Speech 01 Turbo".into(),
            },
        ]
    }

    pub fn list_languages() -> Vec<MinimaxLanguageInfo> {
        MINIMAX_LANGUAGE_CATALOG
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
        let mut options = params.options.clone();
        options.resolve(params.voice_id, params.hub_format, params.model);

        if params.text.chars().count() > SYNC_TEXT_CHAR_LIMIT || options.text_file_id.is_some() {
            return self
                .generate_audio_async(params.model, params.text, params.voice_id, &options)
                .await;
        }

        if options.needs_http_transport() || options.output_format == MinimaxOutputFormat::Url {
            return self
                .generate_audio_http_resolved(
                    params.model,
                    params.text,
                    params.voice_id,
                    &options,
                )
                .await;
        }

        self.generate_audio_ws(params.model, params.text, params.voice_id, &options)
            .await
    }

    async fn generate_audio_ws(
        &self,
        model: &str,
        text: &str,
        voice_id: &str,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAudio> {
        let format = normalize_api_format(&options.audio.format);

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

        let mut start_obj = serde_json::Map::new();
        start_obj.insert("event".into(), serde_json::json!("task_start"));
        start_obj.insert("model".into(), serde_json::json!(model));
        start_obj.insert(
            "voice_setting".into(),
            options.build_voice_setting_json(voice_id),
        );
        start_obj.insert("audio_setting".into(), options.build_audio_setting_json());
        options.append_optional_fields(&mut start_obj);
        let start_msg = serde_json::Value::Object(start_obj);
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
            "text": text,
        });
        write
            .send(Message::Text(continue_msg.to_string()))
            .await
            .context("task_continue send")?;

        let mut audio_data = Vec::new();
        let mut subtitle_url: Option<String> = None;
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

            if let Some(url) = response
                .pointer("/data/subtitle_file")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                subtitle_url = Some(url.to_string());
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

        let subtitle_bytes = if let Some(url) = subtitle_url {
            self.download_url_bytes(&url).await.ok()
        } else {
            None
        };

        Ok(MinimaxAudio {
            bytes: audio_data,
            format: format.to_string(),
            subtitle_bytes,
        })
    }

    async fn generate_audio_http(
        &self,
        model: &str,
        text: &str,
        voice_id: &str,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAudio> {
        let url = t2a_http_base_url(&options.http_region);
        let mut body = serde_json::Map::new();
        body.insert("model".into(), serde_json::json!(model));
        body.insert("text".into(), serde_json::json!(text));
        body.insert("stream".into(), serde_json::json!(options.stream));
        body.insert(
            "output_format".into(),
            serde_json::json!(options.output_format.as_api_str()),
        );
        body.insert(
            "voice_setting".into(),
            options.build_voice_setting_json(voice_id),
        );
        body.insert("audio_setting".into(), options.build_audio_setting_json());
        options.append_optional_fields(&mut body);
        if options.stream {
            body.insert(
                "stream_options".into(),
                serde_json::json!({
                    "exclude_aggregated_audio": options.stream_options.exclude_aggregated_audio,
                }),
            );
        }

        let resp = self
            .http
            .post(url)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&serde_json::Value::Object(body))
            .send()
            .await
            .context("t2a http request")?;

        let status = resp.status();
        let raw = resp.text().await.context("t2a http body")?;

        if options.stream {
            return self.parse_http_stream_response(&raw, &options.audio.format);
        }

        let parsed: serde_json::Value =
            serde_json::from_str(&raw).context("t2a http json")?;
        if !status.is_success() {
            return Err(anyhow!("Minimax HTTP T2A failed ({status}): {parsed}"));
        }
        self.parse_http_sync_response(&parsed, options)
    }

    fn parse_http_sync_response(
        &self,
        response: &serde_json::Value,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAudio> {
        if let Some(code) = response.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
            if code != 0 {
                return Err(anyhow!(
                    "Minimax HTTP error ({code}): {}",
                    minimax_error_message(response)
                ));
            }
        }

        let format = normalize_api_format(&options.audio.format);
        let hex = response
            .pointer("/data/audio")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| anyhow!("Minimax returned no audio data"))?;
        let bytes = hex::decode(hex).context("decode audio hex")?;

        Ok(MinimaxAudio {
            bytes,
            format,
            subtitle_bytes: None,
        })
    }

    fn parse_http_stream_response(&self, raw: &str, audio_format: &str) -> Result<MinimaxAudio> {
        let format = normalize_api_format(audio_format);
        let mut audio_data = Vec::new();

        for line in raw.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            let json_str = line.strip_prefix("data:").unwrap_or(line).trim();
            if json_str.is_empty() || json_str == "[DONE]" {
                continue;
            }
            let chunk: serde_json::Value =
                serde_json::from_str(json_str).unwrap_or(serde_json::Value::Null);
            if let Some(code) = chunk.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
                if code != 0 {
                    return Err(anyhow!(
                        "Minimax HTTP stream error ({code}): {}",
                        minimax_error_message(&chunk)
                    ));
                }
            }
            if let Some(hex) = chunk
                .pointer("/data/audio")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
            {
                let part = hex::decode(hex).context("decode stream hex")?;
                audio_data.extend_from_slice(&part);
            }
        }

        if audio_data.is_empty() {
            // Try parsing as JSON array (non-SSE)
            if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(raw) {
                for chunk in arr {
                    if let Some(hex) = chunk
                        .pointer("/data/audio")
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                    {
                        let part = hex::decode(hex).context("decode array hex")?;
                        audio_data.extend_from_slice(&part);
                    }
                }
            }
        }

        if audio_data.is_empty() {
            return Err(anyhow!("Minimax HTTP stream returned no audio data"));
        }

        Ok(MinimaxAudio {
            bytes: audio_data,
            format,
            subtitle_bytes: None,
        })
    }

    async fn download_url_bytes(&self, url: &str) -> Result<Vec<u8>> {
        let resp = self
            .http
            .get(url)
            .send()
            .await
            .context("download url")?;
        if !resp.status().is_success() {
            return Err(anyhow!("download failed ({})", resp.status()));
        }
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .context("download bytes")
    }

    pub async fn generate_audio_http_resolved(
        &self,
        model: &str,
        text: &str,
        voice_id: &str,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAudio> {
        let mut options = options.clone();
        options.resolve(voice_id, "mp3", model);

        if options.output_format == MinimaxOutputFormat::Url {
            let mut body = serde_json::Map::new();
            body.insert("model".into(), serde_json::json!(model));
            body.insert("text".into(), serde_json::json!(text));
            body.insert("stream".into(), serde_json::json!(false));
            body.insert("output_format".into(), serde_json::json!("url"));
            body.insert(
                "voice_setting".into(),
                options.build_voice_setting_json(voice_id),
            );
            body.insert("audio_setting".into(), options.build_audio_setting_json());
            options.append_optional_fields(&mut body);

            let url = t2a_http_base_url(&options.http_region);
            let resp = self
                .http
                .post(url)
                .header("Authorization", format!("Bearer {}", self.current_api_key()))
                .header("Content-Type", "application/json")
                .json(&serde_json::Value::Object(body))
                .send()
                .await
                .context("t2a http url request")?;
            let parsed: serde_json::Value = resp.json().await.context("t2a url json")?;
            if let Some(code) = parsed.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
                if code != 0 {
                    return Err(anyhow!(
                        "Minimax HTTP error ({code}): {}",
                        minimax_error_message(&parsed)
                    ));
                }
            }
            let audio_url = parsed
                .pointer("/data/audio")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("missing audio url"))?;
            let bytes = self.download_url_bytes(audio_url).await?;
            let subtitle_url = parsed
                .pointer("/data/subtitle_file")
                .and_then(|v| v.as_str())
                .map(str::to_string);
            let subtitle_bytes = if let Some(ref su) = subtitle_url {
                self.download_url_bytes(su).await.ok()
            } else {
                None
            };
            return Ok(MinimaxAudio {
                bytes,
                format: normalize_api_format(&options.audio.format),
                subtitle_bytes,
            });
        }

        if options.stream {
            let url = t2a_http_base_url(&options.http_region);
            let mut body = serde_json::Map::new();
            body.insert("model".into(), serde_json::json!(model));
            body.insert("text".into(), serde_json::json!(text));
            body.insert("stream".into(), serde_json::json!(true));
            body.insert("output_format".into(), serde_json::json!("hex"));
            body.insert(
                "voice_setting".into(),
                options.build_voice_setting_json(voice_id),
            );
            body.insert("audio_setting".into(), options.build_audio_setting_json());
            options.append_optional_fields(&mut body);
            body.insert(
                "stream_options".into(),
                serde_json::json!({
                    "exclude_aggregated_audio": options.stream_options.exclude_aggregated_audio,
                }),
            );
            let resp = self
                .http
                .post(url)
                .header("Authorization", format!("Bearer {}", self.current_api_key()))
                .header("Content-Type", "application/json")
                .json(&serde_json::Value::Object(body))
                .send()
                .await
                .context("t2a http stream")?;
            let raw = resp.text().await.context("stream body")?;
            return self.parse_http_stream_response(&raw, &options.audio.format);
        }

        self.generate_audio_http(model, text, voice_id, &options)
            .await
    }

    pub async fn generate_audio_async(
        &self,
        model: &str,
        text: &str,
        voice_id: &str,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAudio> {
        let mut options = options.clone();
        options.resolve(voice_id, "mp3", model);

        let task = self
            .create_async_task(model, text, voice_id, &options)
            .await?;
        let file_id = task
            .file_id
            .ok_or_else(|| anyhow!("async task missing file_id"))?;

        // Poll until complete (status Success = 2 per MiniMax async API)
        for _ in 0..120 {
            tokio::time::sleep(Duration::from_secs(3)).await;
            let status = self.query_async_task(&task.task_id).await?;
            if status == "Success" || status == "success" || status == "2" {
                break;
            }
            if status == "Failed" || status == "failed" || status == "3" {
                return Err(anyhow!("MiniMax async task failed"));
            }
        }

        let bytes = self.retrieve_file_content(file_id).await?;
        let format = normalize_api_format(&options.audio.format);
        Ok(MinimaxAudio {
            bytes,
            format,
            subtitle_bytes: None,
        })
    }

    pub async fn create_async_task(
        &self,
        model: &str,
        text: &str,
        voice_id: &str,
        options: &MinimaxSynthesisOptions,
    ) -> Result<MinimaxAsyncTaskResult> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let mut body = serde_json::Map::new();
        body.insert("model".into(), serde_json::json!(model));
        if let Some(fid) = options.text_file_id {
            body.insert("text_file_id".into(), serde_json::json!(fid));
        } else {
            body.insert("text".into(), serde_json::json!(text));
        }
        body.insert(
            "voice_setting".into(),
            options.build_voice_setting_json(voice_id),
        );
        let audio = serde_json::json!({
            "audio_sample_rate": options.audio.sample_rate,
            "bitrate": options.audio.bitrate,
            "format": normalize_api_format(&options.audio.format),
            "channel": options.audio.channel,
        });
        body.insert("audio_setting".into(), audio);
        options.append_optional_fields(&mut body);

        let resp = self
            .http
            .post(T2A_ASYNC_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&serde_json::Value::Object(body))
            .send()
            .await
            .context("async create")?;
        let parsed: serde_json::Value = resp.json().await.context("async create json")?;
        if let Some(code) = parsed.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
            if code != 0 {
                return Err(anyhow!(
                    "MiniMax async create error ({code}): {}",
                    minimax_error_message(&parsed)
                ));
            }
        }
        Ok(MinimaxAsyncTaskResult {
            task_id: parsed
                .get("task_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            file_id: parsed.get("file_id").and_then(|v| v.as_i64()),
        })
    }

    pub async fn query_async_task(&self, task_id: &str) -> Result<String> {
        let resp = self
            .http
            .get(T2A_ASYNC_QUERY_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .query(&[("task_id", task_id)])
            .send()
            .await
            .context("async query")?;
        let parsed: serde_json::Value = resp.json().await.context("async query json")?;
        Ok(parsed
            .pointer("/status")
            .or_else(|| parsed.pointer("/data/status"))
            .and_then(|v| v.as_str())
            .unwrap_or("Processing")
            .to_string())
    }

    pub async fn retrieve_file_content(&self, file_id: i64) -> Result<Vec<u8>> {
        let resp = self
            .http
            .get(FILE_RETRIEVE_CONTENT_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .query(&[("file_id", file_id.to_string())])
            .send()
            .await
            .context("retrieve content")?;
        if !resp.status().is_success() {
            let meta = self
                .http
                .get(FILE_RETRIEVE_URL)
                .header("Authorization", format!("Bearer {}", self.current_api_key()))
                .query(&[("file_id", file_id.to_string())])
                .send()
                .await
                .context("retrieve meta")?;
            let meta_json: serde_json::Value = meta.json().await.context("retrieve meta json")?;
            if let Some(url) = meta_json
                .pointer("/file/download_url")
                .and_then(|v| v.as_str())
            {
                return self.download_url_bytes(url).await;
            }
            return Err(anyhow!("retrieve file failed ({})", resp.status()));
        }
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .context("retrieve bytes")
    }

    pub async fn upload_text_file(&self, filename: &str, bytes: Vec<u8>) -> Result<i64> {
        self.upload_voice_file("t2a_async_input", filename, bytes)
            .await
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
        clone_options: &MinimaxCloneOptions,
    ) -> Result<(serde_json::Value, MinimaxCloneResult)> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        validate_voice_id(voice_id).map_err(|e| anyhow!("{e}"))?;

        let mut payload = serde_json::json!({
            "file_id": file_id,
            "voice_id": voice_id,
            "text": preview_text,
            "model": model,
            "need_noise_reduction": clone_options.need_noise_reduction,
            "need_volume_normalization": clone_options.need_volume_normalization,
        });
        if let Some(lang) = clone_options.language.as_deref() {
            let boost = language_boost_from_hub_or_api(Some(lang));
            payload["language_boost"] = serde_json::Value::String(boost);
        }
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
        let meta = MinimaxCloneResult {
            demo_audio_url: body
                .get("demo_audio")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            usage_characters: body
                .pointer("/extra_info/usage_characters")
                .and_then(|v| v.as_i64()),
        };
        Ok((body, meta))
    }

    pub async fn design_voice(
        &self,
        prompt: &str,
        preview_text: &str,
        voice_id: Option<&str>,
    ) -> Result<MinimaxVoiceDesignResult> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let mut payload = serde_json::json!({
            "prompt": prompt,
            "preview_text": preview_text,
        });
        if let Some(vid) = voice_id.filter(|s| !s.trim().is_empty()) {
            validate_voice_id(vid).map_err(|e| anyhow!("{e}"))?;
            payload["voice_id"] = serde_json::Value::String(vid.to_string());
        }

        let resp = self
            .http
            .post(VOICE_DESIGN_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .context("voice design request")?;
        let body: serde_json::Value = resp.json().await.context("voice design json")?;
        if let Some(code) = body.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
            if code != 0 {
                return Err(anyhow!(
                    "Minimax voice_design error ({code}): {}",
                    minimax_error_message(&body)
                ));
            }
        }
        let vid = body
            .get("voice_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("missing voice_id in voice_design response"))?;
        let hex = body
            .get("trial_audio")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let trial_audio_bytes = if hex.is_empty() {
            Vec::new()
        } else {
            hex::decode(hex).context("decode trial_audio hex")?
        };
        Ok(MinimaxVoiceDesignResult {
            voice_id: vid.to_string(),
            trial_audio_bytes,
        })
    }

    pub async fn delete_voice(&self, voice_id: &str) -> Result<()> {
        if !self.is_configured() {
            return Err(anyhow!("MINIMAX_API_KEY is not set"));
        }
        let resp = self
            .http
            .post(DELETE_VOICE_URL)
            .header("Authorization", format!("Bearer {}", self.current_api_key()))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "voice_id": voice_id }))
            .send()
            .await
            .context("delete voice request")?;
        let body: serde_json::Value = resp.json().await.context("delete voice json")?;
        if let Some(code) = body.pointer("/base_resp/status_code").and_then(|v| v.as_i64()) {
            if code != 0 {
                return Err(anyhow!(
                    "Minimax delete_voice error ({code}): {}",
                    minimax_error_message(&body)
                ));
            }
        }
        Ok(())
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

pub fn resolve_minimax_options(
    req_options: Option<MinimaxSynthesisOptions>,
    settings_default: Option<&MinimaxSynthesisOptions>,
    legacy_speed: Option<f32>,
    legacy_vol: Option<f32>,
    legacy_pitch: Option<i32>,
    language: Option<&str>,
) -> MinimaxSynthesisOptions {
    let had_req_options = req_options.is_some();
    let mut opts = req_options
        .or_else(|| settings_default.cloned())
        .unwrap_or_default();
    if !had_req_options && (legacy_speed.is_some() || legacy_vol.is_some() || legacy_pitch.is_some())
    {
        let legacy = MinimaxSynthesisOptions::merge_legacy(legacy_speed, legacy_vol, legacy_pitch);
        opts.voice.speed = legacy.voice.speed;
        opts.voice.vol = legacy.voice.vol;
        opts.voice.pitch = legacy.voice.pitch;
    }
    if let Some(lang) = language {
        opts.language = Some(lang.to_string());
    }
    opts
}
