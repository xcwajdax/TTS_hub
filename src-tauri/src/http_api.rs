use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use crate::audio::AudioFormat;
use crate::commands::{
    create_folder_impl, delete_folder_impl, delete_folder_rule_impl, do_archive, enqueue_request,
    list_folder_rules_impl, list_folders_impl, move_to_folder_impl, rename_folder_impl,
    upsert_folder_rule_impl, GenerateReq,
};
use crate::cursor_integration::{self, TtsHubExportedConfig};
use crate::text_filters::{self, TextFilterPreset};
use crate::db::{Folder, FolderRule, FolderRuleInput, Generation};
use crate::google::VOICES;
use crate::state::AppState;
use crate::voice_samples;

type AppArc = Arc<AppState>;

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
}

fn json_err(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, Json(ErrorBody { error: msg.into() })).into_response()
}

#[derive(Debug, Deserialize)]
struct HistoryQuery {
    scope: Option<String>,
    folder_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VoiceSamplesQuery {
    model: String,
}

#[derive(Debug, Deserialize)]
struct GenerateQuery {
    /// If true, block until the job reaches a terminal status and return the
    /// finalized Generation row (preserves the pre-queue request/response contract).
    #[serde(default)]
    wait: bool,
}

#[derive(Debug, Deserialize)]
struct JobsQuery {
    scope: Option<String>,
}

pub async fn serve(state: AppArc, app_handle: AppHandle) -> Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/voicebox/health", get(voicebox_health))
        .route("/voicebox/profiles", get(voicebox_profiles))
        .route("/voicebox/models", get(voicebox_models))
        .route("/voices", get(voices))
        .route("/voice-samples", get(voice_samples_list))
        .route("/voice-samples/:model/:voice", get(voice_sample_audio))
        .route("/generate", post(generate))
        .route("/history", get(history))
        .route("/history/:id/archive", post(archive))
        .route("/history/:id/folder", post(move_generation_folder))
        .route("/history/:id", delete(delete_one))
        .route("/folders", get(folders_list).post(folders_create))
        .route("/folders/:id", patch(folders_rename).delete(folders_delete))
        .route("/folder-rules", get(folder_rules_list_http).post(folder_rules_upsert_http))
        .route("/folder-rules/:id", delete(folder_rules_delete_http))
        .route("/audio/:id", get(audio))
        .route("/jobs", get(jobs_list))
        .route("/jobs/:id", get(job_get).delete(job_discard))
        .route("/jobs/:id/cancel", post(job_cancel))
        .route("/jobs/:id/resume", post(job_resume))
        .route("/cursor/config", get(cursor_config))
        .route("/text/filter", post(text_filter))
        .route("/integration/status", get(integration_status))
        .with_state(state)
        .layer(Extension(app_handle))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8765").await?;
    log::info!("Local HTTP API listening on http://127.0.0.1:8765");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true, "service": "tts-hub" }))
}

async fn voices() -> Json<Vec<&'static str>> {
    Json(VOICES.to_vec())
}

async fn voicebox_health(State(state): State<AppArc>) -> Response {
    match state.voicebox.health().await {
        Ok(health) => Json(health).into_response(),
        Err(e) => json_err(StatusCode::BAD_GATEWAY, e.to_string()),
    }
}

async fn voicebox_profiles(State(state): State<AppArc>) -> Response {
    match state.voicebox.profiles().await {
        Ok(profiles) => Json(profiles).into_response(),
        Err(e) => json_err(StatusCode::BAD_GATEWAY, e.to_string()),
    }
}

async fn voicebox_models(State(state): State<AppArc>) -> Response {
    match state.voicebox.list_tts_models().await {
        Ok(models) => Json(models).into_response(),
        Err(e) => json_err(StatusCode::BAD_GATEWAY, e.to_string()),
    }
}

async fn voice_samples_list(
    State(state): State<AppArc>,
    Query(q): Query<VoiceSamplesQuery>,
) -> Response {
    if q.model.trim().is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "model is required");
    }
    let paths = match state.paths.read() {
        Ok(p) => p,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    Json(voice_samples::list_status(&paths, &q.model)).into_response()
}

async fn voice_sample_audio(
    State(state): State<AppArc>,
    Path((model, voice)): Path<(String, String)>,
    headers: HeaderMap,
) -> Response {
    let paths = match state.paths.read() {
        Ok(p) => p,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    let path = match voice_samples::sample_path(&paths, &model, &voice) {
        p if p.is_file() => p,
        _ => {
            return json_err(
                StatusCode::NOT_FOUND,
                "sample not found; generate via app first",
            )
        }
    };
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => {
            return json_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("read failed: {e}"),
            )
        }
    };
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());
    audio_bytes_response(bytes, "audio/wav", range)
}

async fn generate(
    State(state): State<AppArc>,
    Extension(_app): Extension<AppHandle>,
    Query(q): Query<GenerateQuery>,
    Json(mut req): Json<GenerateReq>,
) -> Response {
    if req.source.is_none() {
        req.source = Some("http".to_string());
    }
    let queue = match state.job_queue() {
        Some(q) => q,
        None => return json_err(StatusCode::SERVICE_UNAVAILABLE, "job queue not ready"),
    };
    // Subscribe BEFORE enqueueing so we don't miss the terminal update.
    let mut rx = queue.subscribe();
    let queued = match enqueue_request(&state, req) {
        Ok(g) => g,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    };

    if !q.wait {
        return Json(queued).into_response();
    }

    let job_id = queued.id.clone();
    loop {
        match rx.recv().await {
            Ok(evt) if evt.job_id == job_id => match evt.status.as_str() {
                "done" => {
                    return match state.db.get(&job_id) {
                        Ok(Some(g)) => Json(g).into_response(),
                        Ok(None) => json_err(StatusCode::INTERNAL_SERVER_ERROR, "row missing"),
                        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
                    };
                }
                "failed" | "cancelled" => {
                    let msg = evt.error.unwrap_or_else(|| evt.status.clone());
                    return json_err(StatusCode::INTERNAL_SERVER_ERROR, msg);
                }
                _ => continue,
            },
            Ok(_) => continue,
            Err(e) => {
                return json_err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("event loss: {e}"),
                );
            }
        }
    }
}

async fn jobs_list(State(state): State<AppArc>, Query(q): Query<JobsQuery>) -> Response {
    let scope = q.scope.unwrap_or_else(|| "active".to_string());
    let statuses: &[&str] = match scope.as_str() {
        "active" => &["queued", "running"],
        "interrupted" => &["interrupted"],
        "failed" => &["failed"],
        "all" => &["queued", "running", "interrupted", "failed", "cancelled"],
        _ => {
            return json_err(
                StatusCode::BAD_REQUEST,
                "scope must be active|interrupted|failed|all",
            )
        }
    };
    match state.db.list_by_statuses(statuses) {
        Ok(list) => Json::<Vec<Generation>>(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn job_get(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    match state.db.get(&id) {
        Ok(Some(g)) => Json(g).into_response(),
        Ok(None) => json_err(StatusCode::NOT_FOUND, "not found"),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn job_cancel(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    let row = match state.db.get(&id) {
        Ok(Some(g)) => g,
        Ok(None) => return json_err(StatusCode::NOT_FOUND, "not found"),
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    if matches!(row.status.as_str(), "queued" | "running") {
        if let Some(q) = state.job_queue() {
            q.request_cancel(&id);
        }
        if row.status == "queued" {
            let _ = state.db.update_status(&id, "cancelled", None);
        }
    }
    Json(serde_json::json!({ "ok": true })).into_response()
}

async fn job_resume(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    let row = match state.db.get(&id) {
        Ok(Some(g)) => g,
        Ok(None) => return json_err(StatusCode::NOT_FOUND, "not found"),
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    if row.request_json.is_none() {
        return json_err(StatusCode::BAD_REQUEST, "missing original request payload");
    }
    if !matches!(row.status.as_str(), "interrupted" | "failed" | "cancelled") {
        return json_err(
            StatusCode::BAD_REQUEST,
            "can only resume interrupted/failed/cancelled jobs",
        );
    }
    let queue = match state.job_queue() {
        Some(q) => q,
        None => return json_err(StatusCode::SERVICE_UNAVAILABLE, "job queue not ready"),
    };
    if let Err(e) = state.db.mark_queued(&id) {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }
    if let Err(e) = queue.enqueue(id.clone()) {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, format!("{e}"));
    }
    match state.db.get(&id) {
        Ok(Some(g)) => Json(g).into_response(),
        _ => Json(serde_json::json!({ "ok": true, "id": id })).into_response(),
    }
}

async fn job_discard(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    if let Ok(Some(g)) = state.db.get(&id) {
        if !g.file_path.is_empty() && g.status != "done" {
            let _ = std::fs::remove_file(&g.file_path);
        }
    }
    match state.db.delete(&id) {
        Ok(()) => Json(serde_json::json!({ "discarded": id })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn cursor_config(State(state): State<AppArc>) -> Response {
    match state.settings.read() {
        Ok(s) => {
            let cfg = TtsHubExportedConfig {
                cursor: s.cursor_integration.clone(),
                text_filters: s.text_filters.clone(),
            };
            Json(cfg).into_response()
        }
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
struct TextFilterBody {
    text: String,
    preset: TextFilterPreset,
}

async fn text_filter(Json(body): Json<TextFilterBody>) -> Response {
    let result = text_filters::apply_text_filters(&body.text, &body.preset);
    Json(result).into_response()
}

async fn integration_status(State(state): State<AppArc>) -> Response {
    let mut status = match cursor_integration::status() {
        Ok(s) => s,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    status.last_cursor_at = state.db.last_cursor_at().ok().flatten();
    Json(status).into_response()
}

async fn history(State(state): State<AppArc>, Query(q): Query<HistoryQuery>) -> Response {
    let scope = q.scope.unwrap_or_else(|| "session".to_string());
    let res = match scope.as_str() {
        "session" => state.db.list_temp_history(),
        "archive" => match q.folder_id.as_deref() {
            Some("__all__") | None => state.db.list_archive(),
            Some("__none__") => state.db.list_generations_in_folder(None),
            Some(fid) => state.db.list_generations_in_folder(Some(fid)),
        },
        _ => return json_err(StatusCode::BAD_REQUEST, "scope must be session|archive"),
    };
    match res {
        Ok(list) => Json::<Vec<Generation>>(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
struct ArchiveBody {
    format: Option<String>,
}

async fn archive(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    body: Option<Json<ArchiveBody>>,
) -> Response {
    let target = body
        .and_then(|b| b.format.clone())
        .and_then(|s| AudioFormat::from_str(&s))
        .unwrap_or(AudioFormat::Wav);
    match do_archive(&state, id, target, None) {
        Ok(g) => Json(g).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

#[derive(Debug, Deserialize)]
struct MoveFolderBody {
    folder_id: Option<String>,
}

async fn move_generation_folder(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    body: Option<Json<MoveFolderBody>>,
) -> Response {
    let folder_id = body.map(|b| b.folder_id.clone()).unwrap_or(None);
    match move_to_folder_impl(&state, id, folder_id) {
        Ok(g) => Json(g).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

#[derive(Debug, Deserialize)]
struct CreateFolderBody {
    name: String,
    color: Option<String>,
}

async fn folders_list(State(state): State<AppArc>) -> Response {
    match list_folders_impl(&state) {
        Ok(list) => Json::<Vec<Folder>>(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn folders_create(State(state): State<AppArc>, Json(body): Json<CreateFolderBody>) -> Response {
    match create_folder_impl(&state, body.name, body.color) {
        Ok(f) => Json(f).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

#[derive(Debug, Deserialize)]
struct RenameFolderBody {
    name: String,
}

async fn folders_rename(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    Json(body): Json<RenameFolderBody>,
) -> Response {
    match rename_folder_impl(&state, id, body.name) {
        Ok(f) => Json(f).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

#[derive(Debug, Deserialize)]
struct DeleteFolderBody {
    mode: String,
}

async fn folders_delete(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    body: Option<Json<DeleteFolderBody>>,
) -> Response {
    let mode = body
        .map(|b| b.mode.clone())
        .unwrap_or_else(|| "unassign".to_string());
    match delete_folder_impl(&state, id, mode) {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn folder_rules_list_http(State(state): State<AppArc>) -> Response {
    match list_folder_rules_impl(&state) {
        Ok(list) => Json::<Vec<FolderRule>>(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn folder_rules_upsert_http(
    State(state): State<AppArc>,
    Json(body): Json<FolderRuleInput>,
) -> Response {
    match upsert_folder_rule_impl(&state, body) {
        Ok(r) => Json(r).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn folder_rules_delete_http(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    match delete_folder_rule_impl(&state, id) {
        Ok(()) => Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

/// Parse `bytes=start-end` (and suffix forms) for HTTP Range on static audio files.
fn parse_byte_range(range: &str, total: u64) -> Option<(u64, u64)> {
    let spec = range.strip_prefix("bytes=")?;
    let (start, end) = spec.split_once('-')?;
    if total == 0 {
        return None;
    }
    let last = total - 1;
    if !start.is_empty() {
        let s: u64 = start.parse().ok()?;
        if s >= total {
            return None;
        }
        let e = if end.is_empty() {
            last
        } else {
            let e: u64 = end.parse().ok()?;
            e.min(last)
        };
        if s <= e {
            return Some((s, e));
        }
        return None;
    }
    if !end.is_empty() {
        let suffix: u64 = end.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let s = total.saturating_sub(suffix);
        return Some((s, last));
    }
    None
}

/// Serve audio bytes with `Accept-Ranges` / `206 Partial Content` so `<audio>` can seek.
fn audio_bytes_response(bytes: Vec<u8>, mime: &'static str, range_header: Option<&str>) -> Response {
    let total = bytes.len() as u64;
    if total == 0 {
        return (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, mime),
                (header::ACCEPT_RANGES, "bytes"),
                (header::CONTENT_LENGTH, "0"),
            ],
            bytes,
        )
            .into_response();
    }

    if let Some(range) = range_header {
        if let Some((start, end)) = parse_byte_range(range, total) {
            let start = start as usize;
            let end = end as usize;
            let slice = bytes[start..=end].to_vec();
            let content_range = format!("bytes {start}-{end}/{total}");
            let content_length = slice.len().to_string();
            return (
                StatusCode::PARTIAL_CONTENT,
                [
                    (header::CONTENT_TYPE, mime),
                    (header::ACCEPT_RANGES, "bytes"),
                    (header::CONTENT_RANGE, content_range.as_str()),
                    (header::CONTENT_LENGTH, content_length.as_str()),
                ],
                slice,
            )
                .into_response();
        }
        let unsatisfied = format!("bytes */{total}");
        return (
            StatusCode::RANGE_NOT_SATISFIABLE,
            [(header::CONTENT_RANGE, unsatisfied.as_str())],
        )
            .into_response();
    }

    let content_length = total.to_string();
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, mime),
            (header::ACCEPT_RANGES, "bytes"),
            (header::CONTENT_LENGTH, content_length.as_str()),
        ],
        bytes,
    )
        .into_response()
}

async fn delete_one(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    if let Ok(Some(g)) = state.db.get(&id) {
        let _ = std::fs::remove_file(&g.file_path);
    }
    match state.db.delete(&id) {
        Ok(()) => Json(serde_json::json!({ "deleted": id })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn audio(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Response {
    let g = match state.db.get(&id) {
        Ok(Some(g)) => g,
        Ok(None) => return json_err(StatusCode::NOT_FOUND, "not found"),
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    let bytes = match std::fs::read(&g.file_path) {
        Ok(b) => b,
        Err(e) => {
            return json_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("read failed: {e}"),
            )
        }
    };
    let mime = match g.format.as_str() {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        _ => "application/octet-stream",
    };
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());
    audio_bytes_response(bytes, mime, range)
}
