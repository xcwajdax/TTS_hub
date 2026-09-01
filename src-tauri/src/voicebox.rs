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

/// Backend model_name values exposed for PL voice cloning in TTS Hub.
pub const PL_MODEL_NAMES: &[&str] = &["chatterbox-tts", "tada-1b", "tada-3b-ml"];

#[derive(Debug, Deserialize)]
struct ModelStatusListResponse {
    models: Vec<ModelStatus>,
}

#[derive(Debug, Deserialize)]
struct ModelStatus {
    model_name: String,
    display_name: String,
    #[serde(default)]
    hf_repo_id: Option<String>,
    downloaded: bool,
    #[serde(default)]
    downloading: bool,
    #[serde(default)]
    size_mb: Option<f64>,
    #[serde(default)]
    loaded: bool,
}

/// Public PL model status for UI (always one entry per allowlisted model).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxPlModelStatus {
    pub model_name: String,
    pub display_name: String,
    pub hub_model_id: String,
    pub engine: String,
    pub model_size: Option<String>,
    pub downloaded: bool,
    pub downloading: bool,
    pub loaded: bool,
    pub size_mb: Option<f64>,
    /// 0–100 when downloading; from `/tasks/active` when available.
    pub progress: Option<f64>,
    pub bytes_current: Option<u64>,
    pub bytes_total: Option<u64>,
    pub filename: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ActiveTasksResponse {
    #[serde(default)]
    downloads: Vec<ActiveDownloadTask>,
}

#[derive(Debug, Clone, Deserialize)]
struct ActiveDownloadTask {
    model_name: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    progress: Option<f64>,
    #[serde(default)]
    current: Option<i64>,
    #[serde(default)]
    total: Option<i64>,
    #[serde(default)]
    filename: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    error: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct DownloadProgressInfo {
    progress: Option<f64>,
    bytes_current: Option<u64>,
    bytes_total: Option<u64>,
    filename: Option<String>,
    active: bool,
}

#[derive(Debug, Serialize)]
struct ModelDownloadRequest<'a> {
    model_name: &'a str,
}

#[derive(Debug, Serialize)]
struct GenerationRequest<'a> {
    profile_id: &'a str,
    text: &'a str,
    language: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    engine: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model_size: Option<&'a str>,
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
    pub model_size: Option<&'a str>,
    pub instruct: Option<&'a str>,
    pub personality: Option<bool>,
}

/// Map Voicebox generation status → Hub `job:phase` string.
pub fn hub_phase_for_vb_status(status: &str) -> Option<&'static str> {
    match status {
        "loading_model" => Some("vb_loading_model"),
        "completed" | "done" | "failed" | "error" | "not_found" => None,
        // "generating" and any other in-progress status
        _ => Some("vb_generating"),
    }
}

/// Result of tracked generate: audio, or cancelled mid-wait.
pub enum VoiceBoxGenerateOutcome {
    Ready(VoiceBoxAudio),
    Cancelled,
}

/// Progress payload emitted as `voicebox-model-progress`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBoxModelProgressEvent {
    pub model_name: String,
    pub downloading: bool,
    pub downloaded: bool,
    pub loaded: bool,
    pub progress: Option<f64>,
    pub bytes_current: Option<u64>,
    pub bytes_total: Option<u64>,
    pub filename: Option<String>,
    pub error: Option<String>,
}

pub struct VoiceBoxClient {
    base_url: Arc<RwLock<String>>,
    client: reqwest::Client,
}

impl Clone for VoiceBoxClient {
    fn clone(&self) -> Self {
        Self {
            base_url: Arc::clone(&self.base_url),
            client: self.client.clone(),
        }
    }
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
        Ok(self
            .list_pl_model_statuses()
            .await?
            .into_iter()
            .filter(|m| m.downloaded)
            .count())
    }

    pub async fn count_loaded_tts_models(&self) -> Result<usize> {
        Ok(self
            .list_pl_model_statuses()
            .await?
            .into_iter()
            .filter(|m| m.downloaded && m.loaded)
            .count())
    }

    /// Downloaded PL-allowlisted models for TTS dropdowns.
    pub async fn list_tts_models(&self) -> Result<Vec<TtsModelInfo>> {
        let mut models: Vec<TtsModelInfo> = self
            .list_pl_model_statuses()
            .await?
            .into_iter()
            .filter(|m| m.downloaded)
            .map(|m| TtsModelInfo {
                id: m.hub_model_id.clone(),
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

    /// Status for each PL allowlisted model (including not-yet-downloaded).
    pub async fn list_pl_model_statuses(&self) -> Result<Vec<VoiceBoxPlModelStatus>> {
        let response: ModelStatusListResponse = self.get_json("/models/status").await?;
        let progress_by_name = self
            .active_download_progress()
            .await
            .unwrap_or_default();

        let by_name: std::collections::HashMap<String, ModelStatus> = response
            .models
            .into_iter()
            .map(|m| (m.model_name.clone(), m))
            .collect();

        let mut out = Vec::with_capacity(PL_MODEL_NAMES.len());
        for &name in PL_MODEL_NAMES {
            let (engine, model_size, default_display) = pl_model_meta(name);
            let hub_model_id = hub_model_id_for(name).to_string();
            let prog = progress_by_name.get(name).cloned().unwrap_or_default();
            if let Some(m) = by_name.get(name) {
                out.push(VoiceBoxPlModelStatus {
                    model_name: name.to_string(),
                    display_name: m.display_name.clone(),
                    hub_model_id,
                    engine: engine.to_string(),
                    model_size: model_size.map(str::to_string),
                    downloaded: m.downloaded,
                    downloading: m.downloading || prog.active,
                    loaded: m.loaded,
                    size_mb: m.size_mb,
                    progress: prog.progress,
                    bytes_current: prog.bytes_current,
                    bytes_total: prog.bytes_total,
                    filename: prog.filename,
                });
            } else {
                out.push(VoiceBoxPlModelStatus {
                    model_name: name.to_string(),
                    display_name: default_display.to_string(),
                    hub_model_id,
                    engine: engine.to_string(),
                    model_size: model_size.map(str::to_string),
                    downloaded: false,
                    downloading: prog.active,
                    loaded: false,
                    size_mb: None,
                    progress: prog.progress,
                    bytes_current: prog.bytes_current,
                    bytes_total: prog.bytes_total,
                    filename: prog.filename,
                });
            }
        }
        Ok(out)
    }

    async fn active_download_progress(
        &self,
    ) -> Result<std::collections::HashMap<String, DownloadProgressInfo>> {
        let resp: ActiveTasksResponse = self.get_json("/tasks/active").await?;
        let mut map = std::collections::HashMap::new();
        for d in resp.downloads {
            if !is_pl_model(&d.model_name) {
                continue;
            }
            let active = matches!(
                d.status.as_str(),
                "downloading" | "running" | "extracting" | "pending"
            ) || d.progress.is_some();
            // Do not invent 0.0 when progress is missing — that causes UI flicker.
            map.insert(
                d.model_name,
                DownloadProgressInfo {
                    progress: d.progress,
                    bytes_current: d.current.filter(|v| *v >= 0).map(|v| v as u64),
                    bytes_total: d.total.filter(|v| *v >= 0).map(|v| v as u64),
                    filename: d.filename.filter(|s| !s.is_empty()),
                    active,
                },
            );
        }
        Ok(map)
    }

    pub async fn download_model(&self, model_name: &str) -> Result<()> {
        ensure_pl_model(model_name)?;
        let _: serde_json::Value = self
            .post_json(
                "/models/download",
                &ModelDownloadRequest { model_name },
            )
            .await?;
        Ok(())
    }

    pub async fn cancel_model_download(&self, model_name: &str) -> Result<()> {
        ensure_pl_model(model_name)?;
        let _: serde_json::Value = self
            .post_json(
                "/models/download/cancel",
                &ModelDownloadRequest { model_name },
            )
            .await?;
        Ok(())
    }

    pub async fn unload_model(&self, model_name: &str) -> Result<()> {
        ensure_pl_model(model_name)?;
        let url = self.url(&format!("/models/{model_name}/unload"));
        let resp = self
            .client
            .post(url)
            .send()
            .await
            .context("Voice Box unload request failed")?;
        let _: serde_json::Value = self.parse_json(resp).await?;
        Ok(())
    }

    pub async fn generate_audio(
        &self,
        params: VoiceBoxGenerateParams<'_>,
    ) -> Result<VoiceBoxAudio> {
        match self
            .generate_audio_tracked(params, |_| {}, || false)
            .await?
        {
            VoiceBoxGenerateOutcome::Ready(audio) => Ok(audio),
            VoiceBoxGenerateOutcome::Cancelled => {
                Err(anyhow!("Voice Box generation was cancelled"))
            }
        }
    }

    /// Generate with status callbacks (poll `/history/{id}` every 1s until Voicebox finishes).
    pub async fn generate_audio_tracked<F, C>(
        &self,
        params: VoiceBoxGenerateParams<'_>,
        mut on_status: F,
        mut is_cancelled: C,
    ) -> Result<VoiceBoxGenerateOutcome>
    where
        F: FnMut(&str),
        C: FnMut() -> bool,
    {
        let body = GenerationRequest {
            profile_id: params.profile_id,
            text: params.text,
            language: params.language,
            engine: params.engine,
            model_size: params.model_size,
            instruct: params.instruct,
            personality: params.personality,
        };

        let mut generation: VoiceBoxGeneration = self.post_json("/generate", &body).await?;
        on_status(generation.status.as_str());

        generation = match self
            .wait_until_ready(generation, &mut on_status, &mut is_cancelled)
            .await?
        {
            Some(g) => g,
            None => return Ok(VoiceBoxGenerateOutcome::Cancelled),
        };

        let duration_ms = generation
            .duration
            .map(|seconds| (seconds * 1000.0).round() as i64);
        let (bytes, format) = self.download_audio(&generation.id).await?;
        Ok(VoiceBoxGenerateOutcome::Ready(VoiceBoxAudio {
            bytes,
            format,
            duration_ms,
        }))
    }

    pub async fn cancel_generation(&self, generation_id: &str) -> Result<()> {
        let url = self.url(&format!("/generate/{generation_id}/cancel"));
        let resp = self
            .client
            .post(url)
            .send()
            .await
            .context("Voice Box cancel request failed")?;
        let status = resp.status();
        if status.is_success() {
            return Ok(());
        }
        let text = resp.text().await.unwrap_or_default();
        // 400/409 if already finished — treat as soft success for Hub cancel UX
        if status.as_u16() == 400 || status.as_u16() == 409 {
            return Ok(());
        }
        Err(anyhow!(
            "Voice Box cancel HTTP {}: {}",
            status,
            truncate(&text, 500)
        ))
    }

    /// Returns `None` if cancelled mid-wait.
    ///
    /// Keeps polling while Voicebox reports an in-progress status. Long texts
    /// (chunked Chatterbox/TADA) routinely exceed 3 minutes — a fixed poll cap
    /// would fail the Hub job while the sidecar is still working.
    async fn wait_until_ready<F, C>(
        &self,
        mut generation: VoiceBoxGeneration,
        on_status: &mut F,
        is_cancelled: &mut C,
    ) -> Result<Option<VoiceBoxGeneration>>
    where
        F: FnMut(&str),
        C: FnMut() -> bool,
    {
        const POLL_INTERVAL: Duration = Duration::from_secs(1);
        // Give up only after many consecutive poll failures (sidecar unreachable),
        // not because wall-clock time passed while status is still generating.
        const MAX_CONSECUTIVE_POLL_ERRORS: u32 = 30;
        let mut consecutive_errors = 0u32;

        loop {
            if is_cancelled() {
                let _ = self.cancel_generation(&generation.id).await;
                return Ok(None);
            }

            match classify_generation_status(&generation.status) {
                GenerationPoll::Ready => return Ok(Some(generation)),
                GenerationPoll::Failed => {
                    return Err(anyhow!(
                        "{}",
                        humanize_voicebox_generation_error(
                            generation
                                .error
                                .as_deref()
                                .unwrap_or("unknown error")
                        )
                    ));
                }
                GenerationPoll::Cancelled => return Ok(None),
                GenerationPoll::InProgress => {
                    tokio::time::sleep(POLL_INTERVAL).await;
                    if is_cancelled() {
                        let _ = self.cancel_generation(&generation.id).await;
                        return Ok(None);
                    }
                    match self
                        .get_json::<VoiceBoxGeneration>(&format!("/history/{}", generation.id))
                        .await
                    {
                        Ok(updated) => {
                            consecutive_errors = 0;
                            generation = updated;
                            on_status(generation.status.as_str());
                        }
                        Err(err) => {
                            consecutive_errors += 1;
                            if consecutive_errors >= MAX_CONSECUTIVE_POLL_ERRORS {
                                return Err(err).with_context(|| {
                                    format!(
                                        "Voice Box generation {} lost contact after {MAX_CONSECUTIVE_POLL_ERRORS} failed status polls",
                                        generation.id
                                    )
                                });
                            }
                        }
                    }
                }
            }
        }
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

fn is_pl_model(model_name: &str) -> bool {
    PL_MODEL_NAMES.contains(&model_name)
}

fn ensure_pl_model(model_name: &str) -> Result<()> {
    if is_pl_model(model_name) {
        Ok(())
    } else {
        Err(anyhow!(
            "Model „{model_name}” nie jest wspierany w TTS Hub. \
             Dostępne: Chatterbox, TADA 1B, TADA 3B (klon PL)."
        ))
    }
}

fn pl_model_meta(model_name: &str) -> (&'static str, Option<&'static str>, &'static str) {
    match model_name {
        "chatterbox-tts" => ("chatterbox", None, "Chatterbox TTS (Multilingual)"),
        "tada-1b" => ("tada", Some("1B"), "TADA 1B"),
        "tada-3b-ml" => ("tada", Some("3B"), "TADA 3B Multilingual"),
        _ => ("chatterbox", None, "Unknown"),
    }
}

/// Hub TTS model id for a backend model_name.
pub fn hub_model_id_for(model_name: &str) -> &'static str {
    match model_name {
        "chatterbox-tts" => "voicebox:chatterbox",
        "tada-1b" => "voicebox:tada-1b",
        "tada-3b-ml" => "voicebox:tada-3b-ml",
        _ => "voicebox:chatterbox",
    }
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

/// Parse Hub `voicebox:…` model id into (engine, optional model_size for TADA).
pub fn parse_voicebox_model(model: &str) -> Option<(String, Option<String>)> {
    let rest = model.strip_prefix("voicebox:")?.trim();
    if rest.is_empty() {
        return None;
    }
    match rest {
        "chatterbox" | "chatterbox-tts" => Some(("chatterbox".into(), None)),
        "tada-1b" => Some(("tada".into(), Some("1B".into()))),
        "tada-3b-ml" | "tada-3b" => Some(("tada".into(), Some("3B".into()))),
        "tada" => Some(("tada".into(), Some("1B".into()))),
        "chatterbox_turbo" => None, // not in PL allowlist
        other if other == "qwen"
            || other == "qwen_custom_voice"
            || other == "luxtts"
            || other == "kokoro" =>
        {
            None
        }
        other => Some((other.to_string(), None)),
    }
}

/// Engine segment from Hub model id (legacy helper). Prefer `parse_voicebox_model`.
pub fn engine_from_model(model: &str) -> Option<String> {
    parse_voicebox_model(model).map(|(engine, _)| engine)
}

/// Whether engine is allowed for Hub Voice Box synthesis (PL clone).
pub fn is_allowed_pl_engine(engine: &str) -> bool {
    matches!(engine, "chatterbox" | "tada")
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GenerationPoll {
    Ready,
    Failed,
    Cancelled,
    InProgress,
}

fn classify_generation_status(status: &str) -> GenerationPoll {
    match status.trim().to_ascii_lowercase().as_str() {
        "completed" | "done" => GenerationPoll::Ready,
        "failed" | "error" => GenerationPoll::Failed,
        "cancelled" | "canceled" => GenerationPoll::Cancelled,
        _ => GenerationPoll::InProgress,
    }
}

/// Map opaque Voicebox sidecar errors to an action the Hub user can take.
/// Official Voicebox (external Mac app) does not run our Python fork patches.
fn humanize_voicebox_generation_error(raw: &str) -> String {
    let compact = raw.replace('\\', "/").to_ascii_lowercase();
    if compact.contains("spacy_pkuseg")
        && (compact.contains("default.pkl") || compact.contains("_mei"))
    {
        return "Voice Box generation failed: oficjalny Voice Box na Macu ma uszkodzony katalog tymczasowy (brak słownika pkuseg po TADA). Zamknij Voice Box na Macu całkowicie (Cmd+Q) i otwórz ponownie, potem generuj Chatterboxem jeszcze raz. Restart samego TTS Hub tego nie naprawia.".to_string();
    }
    if compact.contains("tls ca certificate") || compact.contains("cacert.pem") {
        return "Voice Box generation failed: Voice Box nie znajduje pakietu certyfikatów TLS (stary katalog tymczasowy). Zamknij Voice Box na Macu całkowicie i otwórz ponownie.".to_string();
    }
    format!("Voice Box generation failed: {raw}")
}

#[cfg(test)]
mod tests {
    use super::{
        classify_generation_status, humanize_voicebox_generation_error, GenerationPoll,
    };

    #[test]
    fn humanizes_stale_pkuseg_mei_path() {
        let raw = "[Errno 2] No such file or directory: '/private/var/folders/w_/x/T/_MEItCp04f/spacy_pkuseg/dicts/default.pkl'";
        let msg = humanize_voicebox_generation_error(raw);
        assert!(msg.contains("Cmd+Q"), "{msg}");
        assert!(msg.contains("pkuseg"), "{msg}");
        assert!(!msg.contains("/private/var/folders"), "{msg}");
    }

    #[test]
    fn passes_through_unknown_voicebox_errors() {
        let msg = humanize_voicebox_generation_error("CUDA out of memory");
        assert_eq!(msg, "Voice Box generation failed: CUDA out of memory");
    }

    #[test]
    fn classifies_terminal_and_in_progress_statuses() {
        assert_eq!(
            classify_generation_status("completed"),
            GenerationPoll::Ready
        );
        assert_eq!(classify_generation_status("DONE"), GenerationPoll::Ready);
        assert_eq!(classify_generation_status("failed"), GenerationPoll::Failed);
        assert_eq!(classify_generation_status("error"), GenerationPoll::Failed);
        assert_eq!(
            classify_generation_status("cancelled"),
            GenerationPoll::Cancelled
        );
        assert_eq!(
            classify_generation_status("generating"),
            GenerationPoll::InProgress
        );
        assert_eq!(
            classify_generation_status("loading_model"),
            GenerationPoll::InProgress
        );
        assert_eq!(
            classify_generation_status("queued"),
            GenerationPoll::InProgress
        );
    }
}
