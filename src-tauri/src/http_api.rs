use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use crate::audio::AudioFormat;
use crate::commands::{do_archive, do_generate, GenerateReq};
use crate::cursor_integration;
use crate::db::Generation;
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
}

#[derive(Debug, Deserialize)]
struct VoiceSamplesQuery {
    model: String,
}

pub async fn serve(state: AppArc, app_handle: AppHandle) -> Result<()> {
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/voices", get(voices))
        .route("/voice-samples", get(voice_samples_list))
        .route("/voice-samples/:model/:voice", get(voice_sample_audio))
        .route("/generate", post(generate))
        .route("/history", get(history))
        .route("/history/:id/archive", post(archive))
        .route("/history/:id", delete(delete_one))
        .route("/audio/:id", get(audio))
        .route("/cursor/config", get(cursor_config))
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
) -> Response {
    let paths = match state.paths.read() {
        Ok(p) => p,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    let path = match voice_samples::sample_path(&paths, &model, &voice) {
        p if p.is_file() => p,
        _ => return json_err(StatusCode::NOT_FOUND, "sample not found; generate via app first"),
    };
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, format!("read failed: {e}")),
    };
    ([(header::CONTENT_TYPE, "audio/wav")], bytes).into_response()
}

async fn generate(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Json(mut req): Json<GenerateReq>,
) -> Response {
    if req.source.is_none() {
        req.source = Some("http".to_string());
    }
    match do_generate(state, req, Some(app)).await {
        Ok(g) => Json(g).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn cursor_config(State(state): State<AppArc>) -> Response {
    match state.settings.read() {
        Ok(s) => Json(s.cursor_integration.clone()).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
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
        "session" => state.db.list_session(&state.session_id),
        "archive" => state.db.list_archive(),
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
    match do_archive(&state, &id, target) {
        Ok(g) => Json(g).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
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

async fn audio(State(state): State<AppArc>, Path(id): Path<String>) -> Response {
    let g = match state.db.get(&id) {
        Ok(Some(g)) => g,
        Ok(None) => return json_err(StatusCode::NOT_FOUND, "not found"),
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    let bytes = match std::fs::read(&g.file_path) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, format!("read failed: {e}")),
    };
    let mime = match g.format.as_str() {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        _ => "application/octet-stream",
    };
    ([(header::CONTENT_TYPE, mime)], bytes).into_response()
}
