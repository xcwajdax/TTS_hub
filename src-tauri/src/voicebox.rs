use anyhow::{anyhow, Context, Result};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use crate::google::TtsModelInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxHealth {
    pub status: String,
    pub model_loaded: bool,
    pub model_downloaded: Option<bool>,
    pub model_size: Option<String>,
    pub gpu_available: bool,
    pub gpu_type: Option<String>,
    pub vram_used_mb: Option<f64>,
    pub backend_type: Option<String>,
    pub backend_variant: Option<String>,
    pub gpu_compatibility_warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub language: String,
    pub default_engine: Option<String>,
    pub personality: Option<String>,
    #[serde(default)]
    pub generation_count: i64,
    #[serde(default)]
    pub sample_count: i64,
    pub voice_type: Option<String>,
    pub avatar_path: Option<String>,
    pub preset_engine: Option<String>,
    pub preset_voice_id: Option<String>,
    pub design_prompt: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxProfileCreate {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preset_engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preset_voice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub design_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub personality: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxSample {
    pub id: String,
    pub profile_id: String,
    pub audio_path: String,
    pub reference_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxHistoryItem {
    pub id: String,
    pub profile_id: String,
    pub profile_name: Option<String>,
    pub text: String,
    pub language: String,
    pub audio_path: Option<String>,
    pub duration: Option<f64>,
    pub seed: Option<i64>,
    pub instruct: Option<String>,
    pub engine: Option<String>,
    pub model_size: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub is_favorited: Option<bool>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxHistoryList {
    pub items: Vec<VoiceBoxHistoryItem>,
    pub total: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VoiceBoxHistoryQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceBoxAudioPayload {
    pub bytes_base64: String,
    pub format: String,
}

#[derive(Debug, Deserialize)]
struct ModelStatusListResponse {
    models: Vec<ModelStatus>,
}

#[derive(Debug, Deserialize)]
struct ModelStatus {
    model_name: String,
    display_name: String,
    downloaded: bool,
    #[serde(default)]
    loaded: bool,
}

#[derive(Debug, Serialize)]
struct GenerationRequest<'a> {
    profile_id: &'a str,
    text: &'a str,
    language: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    engine: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    instruct: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    personality: Option<bool>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct VoiceBoxGeneration {
    pub id: String,
    pub profile_id: String,
    pub text: String,
    pub language: String,
    pub audio_path: Option<String>,
    pub duration: Option<f64>,
    pub engine: Option<String>,
    pub model_size: Option<String>,
    #[serde(default = "default_completed_status")]
    pub status: String,
    pub error: Option<String>,
}

fn default_completed_status() -> String {
    "completed".to_string()
}

pub struct VoiceBoxAudio {
    pub bytes: Vec<u8>,
    pub format: String,
    pub duration_ms: Option<i64>,
}

pub struct VoiceBoxGenerateParams<'a> {
    pub profile_id: &'a str,
    pub text: &'a str,
    pub language: &'a str,
    pub engine: Option<&'a str>,
    pub instruct: Option<&'a str>,
    pub personality: Option<bool>,
}

pub struct VoiceBoxClient {
    base_url: Arc<RwLock<String>>,
    client: reqwest::Client,
}

fn voicebox_client_http() -> reqwest::Client {
    let user_agent = format!(
        "TTS-Hub/{} (Voicebox-client; https://github.com/xcwajdax/TTS_hub)",
        env!("CARGO_PKG_VERSION")
    );
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_str(&user_agent).expect("valid User-Agent"),
    );
    headers.insert(
        HeaderName::from_static("x-voicebox-client-id"),
        HeaderValue::from_static("tts-hub"),
    );
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .default_headers(headers)
        .build()
        .expect("reqwest client")
}

impl VoiceBoxClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url: Arc::new(RwLock::new(base_url.trim_end_matches('/').to_string())),
            client: voicebox_client_http(),
        }
    }

    pub fn set_base_url(&self, base_url: String) {
        if let Ok(mut guard) = self.base_url.write() {
            *guard = base_url.trim_end_matches('/').to_string();
        }
    }

    pub fn base_url(&self) -> String {
        self.base_url
            .read()
            .map(|g| g.clone())
            .unwrap_or_else(|_| "http://127.0.0.1:17493".to_string())
    }

    pub async fn health(&self) -> Result<VoiceBoxHealth> {
        self.get_json("/health").await
    }

    pub async fn profiles(&self) -> Result<Vec<VoiceBoxProfile>> {
        let mut profiles: Vec<VoiceBoxProfile> = self.get_json("/profiles").await?;
        profiles.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(profiles)
    }

    pub async fn get_profile(&self, profile_id: &str) -> Result<VoiceBoxProfile> {
        self.get_json(&format!("/profiles/{profile_id}")).await
    }

    pub async fn create_profile(&self, body: &VoiceBoxProfileCreate) -> Result<VoiceBoxProfile> {
        self.post_json("/profiles", body).await
    }

    pub async fn update_profile(
        &self,
        profile_id: &str,
        body: &VoiceBoxProfileCreate,
    ) -> Result<VoiceBoxProfile> {
        self.put_json(&format!("/profiles/{profile_id}"), body).await
    }

    pub async fn delete_profile(&self, profile_id: &str) -> Result<()> {
        self.delete(&format!("/profiles/{profile_id}")).await
    }

    pub async fn fetch_profile_avatar(&self, profile_id: &str) -> Result<Option<Vec<u8>>> {
        let url = self.url(&format!("/profiles/{profile_id}/avatar"));
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("Voice Box avatar request failed")?;
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let status = resp.status();
        let bytes = resp.bytes().await.context("Voice Box avatar read failed")?;
        if !status.is_success() {
            return Err(anyhow!(
                "Voice Box avatar HTTP {}: {}",
                status,
                truncate(&String::from_utf8_lossy(&bytes), 500)
            ));
        }
        Ok(Some(bytes.to_vec()))
    }

    pub async fn list_profile_samples(&self, profile_id: &str) -> Result<Vec<VoiceBoxSample>> {
        self.get_json(&format!("/profiles/{profile_id}/samples"))
            .await
    }

    pub async fn add_profile_sample(
        &self,
        profile_id: &str,
        file_path: &str,
        reference_text: &str,
    ) -> Result<VoiceBoxSample> {
        let path = Path::new(file_path);
        if !path.is_file() {
            return Err(anyhow!("sample file not found: {file_path}"));
        }
        let bytes = std::fs::read(path).with_context(|| format!("read sample file {file_path}"))?;
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("sample.wav")
            .to_string();
        let mime = sample_mime_from_filename(&filename);
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(filename)
            .mime_str(&mime)
            .context("sample mime")?;
        let form = reqwest::multipart::Form::new()
            .text("reference_text", reference_text.to_string())
            .part("file", part);
        let url = self.url(&format!("/profiles/{profile_id}/samples"));
        let resp = self
            .client
            .post(url)
            .multipart(form)
            .send()
            .await
            .context("Voice Box sample upload failed")?;
        self.parse_json(resp).await
    }

    pub async fn delete_sample(&self, sample_id: &str) -> Result<()> {
        self.delete(&format!("/profiles/samples/{sample_id}")).await
    }

    pub async fn fetch_sample_audio(&self, sample_id: &str) -> Result<VoiceBoxAudioPayload> {
        let (bytes, format) = self.fetch_audio_path(&format!("/samples/{sample_id}")).await?;
        Ok(audio_payload(bytes, format))
    }

    pub async fn list_history(&self, query: &VoiceBoxHistoryQuery) -> Result<VoiceBoxHistoryList> {
        let mut req = self.client.get(self.url("/history"));
        if let Some(profile_id) = query.profile_id.as_deref().filter(|s| !s.is_empty()) {
            req = req.query(&[("profile_id", profile_id)]);
        }
        if let Some(search) = query.search.as_deref().filter(|s| !s.is_empty()) {
            req = req.query(&[("search", search)]);
        }
        if let Some(limit) = query.limit {
            req = req.query(&[("limit", limit.to_string())]);
        }
        if let Some(offset) = query.offset {
            req = req.query(&[("offset", offset.to_string())]);
        }
        let resp = req.send().await.context("Voice Box history request failed")?;
        self.parse_json(resp).await
    }

    pub async fn get_history_item(&self, generation_id: &str) -> Result<VoiceBoxHistoryItem> {
        self.get_json(&format!("/history/{generation_id}")).await
    }

    pub async fn delete_history_item(&self, generation_id: &str) -> Result<()> {
        self.delete(&format!("/history/{generation_id}")).await
    }

    pub async fn fetch_generation_audio(&self, generation_id: &str) -> Result<VoiceBoxAudioPayload> {
        let (bytes, format) = self.download_audio(generation_id).await?;
        Ok(audio_payload(bytes, format))
    }

    pub async fn count_downloaded_tts_models(&self) -> Result<usize> {
        let response: ModelStatusListResponse = self.get_json("/models/status").await?;
        Ok(response
            .models
            .iter()
            .filter(|m| m.downloaded && is_tts_model(&m.model_name))
            .count())
    }

    pub async fn count_loaded_tts_models(&self) -> Result<usize> {
        let response: ModelStatusListResponse = self.get_json("/models/status").await?;
        Ok(response
            .models
            .iter()
            .filter(|m| m.downloaded && m.loaded && is_tts_model(&m.model_name))
            .count())
    }

    pub async fn list_tts_models(&self) -> Result<Vec<TtsModelInfo>> {
        let response: ModelStatusListResponse = self.get_json("/models/status").await?;
        let mut models: Vec<TtsModelInfo> = response
            .models
            .into_iter()
            .filter(|m| m.downloaded && is_tts_model(&m.model_name))
            .map(|m| TtsModelInfo {
                id: format!("voicebox:{}", engine_id(&m.model_name)),
                display_name: if m.loaded {
                    format!("Voice Box {} (loaded)", m.display_name)
                } else {
                    format!("Voice Box {}", m.display_name)
                },
            })
            .collect();
        models.sort_by(|a, b| a.display_name.cmp(&b.display_name));
        Ok(models)
    }

    pub async fn generate_audio(
        &self,
        params: VoiceBoxGenerateParams<'_>,
    ) -> Result<VoiceBoxAudio> {
        let body = GenerationRequest {
            profile_id: params.profile_id,
            text: params.text,
            language: params.language,
            engine: params.engine,
            instruct: params.instruct,
            personality: params.personality,
        };

        let mut generation: VoiceBoxGeneration = self.post_json("/generate", &body).await?;
        generation = self.wait_until_ready(generation).await?;
        let duration_ms = generation
            .duration
            .map(|seconds| (seconds * 1000.0).round() as i64);
        let (bytes, format) = self.download_audio(&generation.id).await?;
        Ok(VoiceBoxAudio {
            bytes,
            format,
            duration_ms,
        })
    }

    async fn wait_until_ready(
        &self,
        mut generation: VoiceBoxGeneration,
    ) -> Result<VoiceBoxGeneration> {
        for _ in 0..60 {
            match generation.status.as_str() {
                "completed" | "done" => return Ok(generation),
                "failed" | "error" => {
                    return Err(anyhow!(
                        "Voice Box generation failed: {}",
                        generation
                            .error
                            .unwrap_or_else(|| "unknown error".to_string())
                    ));
                }
                _ => {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    generation = self
                        .get_json(&format!("/history/{}", generation.id))
                        .await
                        .with_context(|| {
                            format!("Voice Box generation {} did not finish", generation.id)
                        })?;
                }
            }
        }
        Err(anyhow!("Voice Box generation timed out"))
    }

    async fn download_audio(&self, id: &str) -> Result<(Vec<u8>, String)> {
        self.fetch_audio_path(&format!("/audio/{id}")).await
    }

    async fn fetch_audio_path(&self, path: &str) -> Result<(Vec<u8>, String)> {
        let url = self.url(path);
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("Voice Box audio request failed")?;
        let status = resp.status();
        let content_type = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let bytes = resp.bytes().await.context("Voice Box audio read failed")?;
        if !status.is_success() {
            return Err(anyhow!(
                "Voice Box audio HTTP {}: {}",
                status,
                truncate(&String::from_utf8_lossy(&bytes), 500)
            ));
        }
        Ok((
            bytes.to_vec(),
            audio_format_from_content_type(&content_type),
        ))
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, path: &str) -> Result<T> {
        let url = self.url(path);
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("Voice Box request failed")?;
        self.parse_json(resp).await
    }

    async fn post_json<B: Serialize, T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = self.url(path);
        let resp = self
            .client
            .post(url)
            .json(body)
            .send()
            .await
            .context("Voice Box request failed")?;
        self.parse_json(resp).await
    }

    async fn put_json<B: Serialize, T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let url = self.url(path);
        let resp = self
            .client
            .put(url)
            .json(body)
            .send()
            .await
            .context("Voice Box request failed")?;
        self.parse_json(resp).await
    }

    async fn delete(&self, path: &str) -> Result<()> {
        let url = self.url(path);
        let resp = self
            .client
            .delete(url)
            .send()
            .await
            .context("Voice Box delete request failed")?;
        let status = resp.status();
        if status.is_success() {
            return Ok(());
        }
        let text = resp.text().await.unwrap_or_default();
        Err(anyhow!(
            "Voice Box HTTP {}: {}",
            status,
            truncate(&text, 500)
        ))
    }

    async fn parse_json<T: for<'de> Deserialize<'de>>(&self, resp: reqwest::Response) -> Result<T> {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!(
                "Voice Box HTTP {}: {}",
                status,
                truncate(&text, 500)
            ));
        }
        serde_json::from_str(&text)
            .with_context(|| format!("invalid Voice Box JSON: {}", truncate(&text, 300)))
    }

    fn url(&self, path: &str) -> String {
        let base = self
            .base_url
            .read()
            .map(|g| g.clone())
            .unwrap_or_else(|_| "http://127.0.0.1:17493".to_string());
        format!("{}{}", base, path)
    }
}

fn audio_payload(bytes: Vec<u8>, format: String) -> VoiceBoxAudioPayload {
    VoiceBoxAudioPayload {
        bytes_base64: base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &bytes,
        ),
        format,
    }
}

fn sample_mime_from_filename(filename: &str) -> String {
    let lower = filename.to_ascii_lowercase();
    if lower.ends_with(".mp3") {
        "audio/mpeg".to_string()
    } else if lower.ends_with(".m4a") {
        "audio/mp4".to_string()
    } else if lower.ends_with(".ogg") {
        "audio/ogg".to_string()
    } else {
        "audio/wav".to_string()
    }
}

fn is_tts_model(model_name: &str) -> bool {
    matches!(
        model_name,
        "qwen-tts-1.7B"
            | "qwen-tts-0.6B"
            | "qwen-custom-voice-1.7B"
            | "qwen-custom-voice-0.6B"
            | "luxtts"
            | "chatterbox-tts"
            | "chatterbox-turbo"
            | "tada-1b"
            | "tada-3b-ml"
            | "kokoro"
    )
}

pub fn engine_id(model_id: &str) -> &'static str {
    match model_id {
        "qwen-tts-1.7B" | "qwen-tts-0.6B" => "qwen",
        "qwen-custom-voice-1.7B" | "qwen-custom-voice-0.6B" => "qwen_custom_voice",
        "luxtts" => "luxtts",
        "chatterbox-tts" => "chatterbox",
        "chatterbox-turbo" => "chatterbox_turbo",
        "tada-1b" | "tada-3b-ml" => "tada",
        "kokoro" => "kokoro",
        _ => "chatterbox",
    }
}

pub fn engine_from_model(model: &str) -> Option<&str> {
    model.strip_prefix("voicebox:").filter(|s| !s.is_empty())
}

fn audio_format_from_content_type(content_type: &str) -> String {
    let lower = content_type.to_ascii_lowercase();
    if lower.contains("mpeg") || lower.contains("mp3") {
        "mp3".to_string()
    } else if lower.contains("ogg") {
        "ogg".to_string()
    } else {
        "wav".to_string()
    }
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        s.to_string()
    } else {
        format!("{}...", &s[..n])
    }
}
