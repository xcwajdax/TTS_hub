use std::sync::Arc;

use anyhow::Result;
use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

use crate::audio::AudioFormat;
use crate::app_settings::{PROVIDER_GOOGLE, PROVIDER_MINIMAX, PROVIDER_VOICEBOX};
use crate::commands::{
    approve_generation_ids, create_folder_impl, delete_folder_impl, delete_folder_rule_impl,
    do_archive, enqueue_request, list_folder_rules_impl, list_folders_impl,
    minimax_clone_voice_impl, move_to_folder_impl, reject_generation_ids, rename_folder_impl,
    sync_minimax_voices_impl, upsert_folder_rule_impl, GenerateReq,
};
use crate::db::STATUS_PENDING_APPROVAL;
use crate::cursor_integration::{self, TtsHubExportedConfig};
use crate::db::{Folder, FolderRule, FolderRuleInput, Generation};
use crate::google::VOICES;
use crate::minimax::{MinimaxClient, MinimaxCloneOptions};
use crate::state::AppState;
use crate::text_filters::{self, TextFilterPreset};
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

#[derive(Debug, Deserialize)]
struct UsageQuery {
    /// If set, return only this provider. If absent, return all enabled providers.
    provider: Option<String>,
    /// Reserved for future use — only `24h` is implemented right now.
    #[serde(default)]
    window: Option<String>,
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
        .route(
            "/folder-rules",
            get(folder_rules_list_http).post(folder_rules_upsert_http),
        )
        .route("/folder-rules/:id", delete(folder_rules_delete_http))
        .route("/audio/:id", get(audio))
        .route("/jobs", get(jobs_list))
        .route("/jobs/approve", post(jobs_approve))
        .route("/jobs/reject", post(jobs_reject))
        .route("/jobs/:id", get(job_get).delete(job_discard))
        .route("/jobs/:id/cancel", post(job_cancel))
        .route("/jobs/:id/resume", post(job_resume))
        .route("/cursor/config", get(cursor_config))
        .route("/minimax/sync-voices", post(minimax_sync_voices_http))
        .route("/minimax/clone-voice", post(minimax_clone_voice_http))
        .route("/minimax/voice-design", post(minimax_voice_design_http))
        .route("/minimax/voices/:voice_id", delete(minimax_delete_voice_http))
        .route("/minimax/languages", get(minimax_languages_http))
        .route("/minimax/upload-text", post(minimax_upload_text_http))
        .route("/text/filter", post(text_filter))
        .route("/integration/status", get(integration_status))
        .route("/plugins", get(plugins_list))
        .route("/plugins/:id/install", post(plugin_install))
        .route("/plugins/:id/install", delete(plugin_uninstall))
        .route("/plugins/:id", patch(plugin_set_enabled))
        .route("/plugins/soundboard", get(soundboard_get))
        .route(
            "/plugins/soundboard/slots/:index",
            put(soundboard_put_slot)
                .patch(soundboard_patch_slot)
                .delete(soundboard_delete_slot),
        )
        .route(
            "/plugins/soundboard/slots/:index/play",
            post(soundboard_play_slot),
        )
        .route(
            "/plugins/soundboard/slots/:index/audio",
            get(soundboard_slot_audio),
        )
        // === chat-window extension (2026-06-06) ===
        .route("/chat/sessions", get(chat_list_sessions_http).post(chat_create_session_http))
        .route(
            "/chat/sessions/:id",
            get(chat_get_session_http)
                .patch(chat_update_session_http)
                .delete(chat_delete_session_http),
        )
        .route(
            "/chat/sessions/:id/messages",
            get(chat_list_messages_http).post(chat_add_message_http),
        )
        .route("/chat/sessions/:id/replay/:message_id", post(chat_replay_message_http))
        .route("/chat/sources", get(chat_list_sources_http))
        // === local per-provider usage counter (2026-06-07) ===
        // NOTE: deliberately NO /usage/remaining endpoint — MiniMax API has no
        // quota signal; see the IMPORTANT block in src-tauri/src/minimax.rs.
        .route("/usage", get(usage_http))
        // === origin attribution (2026-06-07) — additive ===
        // List generations whose `origin_kind` matches `?kind=…` (free-form,
        // e.g. "telegram", "discord", "webhook", "cli"). Useful for the
        // Telegram bot to query its own history.
        .route("/generations/by-origin", get(generations_by_origin_http))
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

// === local per-provider usage counter (2026-06-07) ===
//
// GET /usage?provider=minimax&window=24h  → one ProviderUsage
// GET /usage                              → list of every provider we have
//                                           ever seen in the generations table,
//                                           sorted alphabetically by name.
//
// We deliberately do NOT expose /usage/remaining — there is no real
// upstream signal to read. See the IMPORTANT block in src-tauri/src/minimax.rs.
async fn usage_http(
    State(state): State<AppArc>,
    Query(q): Query<UsageQuery>,
) -> Response {
    let now = chrono::Utc::now().timestamp();
    // `window` is reserved for future use; the only window we have right now
    // is 24h. We accept the param and validate it lightly so we can extend
    // to "1h" / "7d" later without a breaking change.
    if let Some(w) = q.window.as_deref() {
        if !w.is_empty() && w != "24h" {
            return json_err(
                StatusCode::BAD_REQUEST,
                format!("unsupported window '{w}' (only '24h' is implemented)"),
            );
        }
    }

    if let Some(provider) = q.provider.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        // Single-provider mode.
        let p_norm = provider.to_ascii_lowercase();
        if !matches!(
            p_norm.as_str(),
            PROVIDER_GOOGLE | PROVIDER_VOICEBOX | PROVIDER_MINIMAX
        ) {
            return json_err(
                StatusCode::BAD_REQUEST,
                format!(
                    "unknown provider '{provider}' (allowed: {PROVIDER_GOOGLE}, {PROVIDER_VOICEBOX}, {PROVIDER_MINIMAX})"
                ),
            );
        }
        match crate::usage::compute_usage(&state.db, &p_norm, now) {
            Ok(u) => Json(u).into_response(),
            Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        }
    } else {
        // Multi-provider mode: every distinct provider we have ever recorded.
        match crate::usage::compute_all_providers(&state.db, now) {
            Ok(list) => Json(list).into_response(),
            Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        }
    }
}

// === origin attribution (2026-06-07) ===
//
// GET /generations/by-origin?kind=telegram&limit=50
//
// Returns the most recent generations tagged with the given `origin_kind`
// (free-form). The kind is whatever an external caller put in the
// `origin.kind` field of the GenerateReq it sent to /generate — typically
// "telegram", "discord", "webhook", or "cli".
#[derive(Debug, Deserialize)]
struct ByOriginQuery {
    kind: String,
    #[serde(default)]
    limit: Option<i64>,
}

async fn generations_by_origin_http(
    State(state): State<AppArc>,
    Query(q): Query<ByOriginQuery>,
) -> Response {
    let kind = q.kind.trim();
    if kind.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "kind is required");
    }
    let lim = q.limit.unwrap_or(100).clamp(1, 1000);
    match state.db.list_by_origin_kind(kind, lim) {
        Ok(list) => Json(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
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
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
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
        "pending_approval" => &[STATUS_PENDING_APPROVAL],
        "all" => &[
            "queued",
            "running",
            "interrupted",
            "failed",
            "cancelled",
            STATUS_PENDING_APPROVAL,
            "rejected",
        ],
        _ => {
            return json_err(
                StatusCode::BAD_REQUEST,
                "scope must be active|interrupted|failed|pending_approval|all",
            )
        }
    };
    match state.db.list_by_statuses(statuses) {
        Ok(list) => Json::<Vec<Generation>>(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
struct BulkJobIds {
    ids: Vec<String>,
}

async fn jobs_approve(State(state): State<AppArc>, Json(body): Json<BulkJobIds>) -> Response {
    match approve_generation_ids(&state, &body.ids) {
        Ok(result) => Json(result).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn jobs_reject(State(state): State<AppArc>, Json(body): Json<BulkJobIds>) -> Response {
    match reject_generation_ids(&state, &body.ids) {
        Ok(result) => Json(result).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
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

#[derive(Debug, Deserialize)]
struct MinimaxCloneVoiceBody {
    source_path: String,
    voice_id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    preview_text: Option<String>,
    #[serde(default)]
    prompt_path: Option<String>,
    #[serde(default)]
    prompt_text: Option<String>,
    #[serde(default)]
    clone_options: Option<crate::minimax::MinimaxCloneOptions>,
}

async fn minimax_clone_voice_http(
    State(state): State<AppArc>,
    Json(body): Json<MinimaxCloneVoiceBody>,
) -> Response {
    let voice_id = body.voice_id.trim().to_string();
    if voice_id.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "voice_id is required".to_string());
    }
    let source_path = body.source_path.trim().to_string();
    if source_path.is_empty() || !std::path::Path::new(&source_path).is_file() {
        return json_err(
            StatusCode::BAD_REQUEST,
            format!("source_path not found: {source_path}"),
        );
    }
    let name = body
        .name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| voice_id.clone());
    let model = body
        .model
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "minimax:speech-2.8-hd".to_string());
    let preview_text = body.preview_text.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        "Szanowni państwo, witam w kolejnym odcinku kulinarnej podróży.".to_string()
    });
    match minimax_clone_voice_impl(
        &state,
        source_path,
        voice_id,
        name,
        model,
        preview_text,
        body.prompt_path,
        body.prompt_text,
        body.clone_options.unwrap_or_default(),
    )
    .await
    {
        Ok(entry) => Json(entry).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn minimax_sync_voices_http(State(state): State<AppArc>) -> Response {
    match sync_minimax_voices_impl(&state).await {
        Ok(result) => Json(result).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn minimax_languages_http() -> Response {
    Json(MinimaxClient::list_languages()).into_response()
}

#[derive(Debug, Deserialize)]
struct MinimaxVoiceDesignBody {
    prompt: String,
    preview_text: String,
    #[serde(default)]
    voice_id: Option<String>,
}

async fn minimax_voice_design_http(
    State(state): State<AppArc>,
    Json(body): Json<MinimaxVoiceDesignBody>,
) -> Response {
    match state
        .minimax
        .design_voice(&body.prompt, &body.preview_text, body.voice_id.as_deref())
        .await
    {
        Ok(result) => Json(result).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

async fn minimax_delete_voice_http(
    State(state): State<AppArc>,
    Path(voice_id): Path<String>,
) -> Response {
    match state.minimax.delete_voice(&voice_id).await {
        Ok(()) => Json(serde_json::json!({ "ok": true, "voice_id": voice_id })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
struct MinimaxUploadTextBody {
    file_path: String,
}

async fn minimax_upload_text_http(
    State(state): State<AppArc>,
    Json(body): Json<MinimaxUploadTextBody>,
) -> Response {
    let path = body.file_path.trim();
    if path.is_empty() || !std::path::Path::new(path).is_file() {
        return json_err(StatusCode::BAD_REQUEST, format!("file not found: {path}"));
    }
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::BAD_REQUEST, e.to_string()),
    };
    let filename = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("input.txt");
    match state.minimax.upload_text_file(filename, bytes).await {
        Ok(file_id) => Json(serde_json::json!({ "file_id": file_id })).into_response(),
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
        "bots" => state.db.list_bots_feed(50),
        "archive" => match q.folder_id.as_deref() {
            Some("__all__") | None => state.db.list_archive(),
            Some("__none__") => state.db.list_generations_in_folder(None),
            Some(fid) => state.db.list_generations_in_folder(Some(fid)),
        },
        _ => return json_err(StatusCode::BAD_REQUEST, "scope must be session|archive|bots"),
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

async fn folders_create(
    State(state): State<AppArc>,
    Json(body): Json<CreateFolderBody>,
) -> Response {
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
fn audio_bytes_response(
    bytes: Vec<u8>,
    mime: &'static str,
    range_header: Option<&str>,
) -> Response {
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

async fn plugins_list(State(state): State<AppArc>) -> Response {
    match crate::plugins::get_plugins_list(&state) {
        Ok(list) => Json(list).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginEnabledBody {
    enabled: bool,
}

async fn plugin_install(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(id): Path<String>,
) -> Response {
    match crate::plugins::install_plugin_impl(&state, &id) {
        Ok(list) => {
            let _ = crate::plugins::reload_after_plugin_change(&app, &state);
            Json(list).into_response()
        }
        Err(e) => json_err(StatusCode::BAD_REQUEST, e),
    }
}

async fn plugin_uninstall(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(id): Path<String>,
) -> Response {
    match crate::plugins::uninstall_plugin_impl(&state, &id) {
        Ok(list) => {
            let _ = crate::plugins::reload_after_plugin_change(&app, &state);
            Json(list).into_response()
        }
        Err(e) => json_err(StatusCode::BAD_REQUEST, e),
    }
}

async fn plugin_set_enabled(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(id): Path<String>,
    Json(body): Json<PluginEnabledBody>,
) -> Response {
    match crate::plugins::set_plugin_enabled_impl(&state, &id, body.enabled) {
        Ok(list) => {
            let _ = crate::plugins::reload_after_plugin_change(&app, &state);
            Json(list).into_response()
        }
        Err(e) => json_err(StatusCode::BAD_REQUEST, e),
    }
}

async fn soundboard_get(State(state): State<AppArc>) -> Response {
    match crate::plugins::get_soundboard_public(&state) {
        Ok(view) => Json(view).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn soundboard_put_slot(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(index): Path<usize>,
    Json(body): Json<crate::plugins::soundboard::AssignSoundboardSlotReq>,
) -> Response {
    if let Err(e) = crate::plugins::set_soundboard_slot_impl(&state, index, body) {
        return json_err(StatusCode::BAD_REQUEST, e);
    }
    let _ = crate::global_shortcuts::reload_all(&app, &state);
    match crate::plugins::get_soundboard_public(&state) {
        Ok(view) => Json(view).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn soundboard_patch_slot(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(index): Path<usize>,
    Json(body): Json<crate::plugins::soundboard::PatchSoundboardSlotReq>,
) -> Response {
    if let Err(e) = crate::plugins::update_soundboard_slot_impl(&state, index, body) {
        return json_err(StatusCode::BAD_REQUEST, e);
    }
    let _ = crate::global_shortcuts::reload_all(&app, &state);
    match crate::plugins::get_soundboard_public(&state) {
        Ok(view) => Json(view).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn soundboard_delete_slot(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(index): Path<usize>,
) -> Response {
    if let Err(e) = crate::plugins::clear_soundboard_slot_impl(&state, index) {
        return json_err(StatusCode::BAD_REQUEST, e);
    }
    let _ = crate::global_shortcuts::reload_all(&app, &state);
    match crate::plugins::get_soundboard_public(&state) {
        Ok(view) => Json(view).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e),
    }
}

async fn soundboard_play_slot(
    State(state): State<AppArc>,
    Extension(app): Extension<AppHandle>,
    Path(index): Path<usize>,
) -> Response {
    match crate::plugins::play_soundboard_slot_impl(&app, &state, index) {
        Ok(()) => Json(serde_json::json!({ "ok": true, "slot_index": index })).into_response(),
        Err(e) => json_err(StatusCode::BAD_REQUEST, e),
    }
}

async fn soundboard_slot_audio(
    State(state): State<AppArc>,
    Path(index): Path<usize>,
    headers: HeaderMap,
) -> Response {
    let path = match crate::plugins::soundboard::soundboard_slot_audio_path(&state, index) {
        Ok(p) => p,
        Err(e) => return json_err(StatusCode::NOT_FOUND, e),
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
    let mime = mime_for_path(&path);
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());
    audio_bytes_response(bytes, mime, range)
}

fn mime_for_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("wav") => "audio/wav",
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        _ => "application/octet-stream",
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
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    audio_bytes_response(bytes, mime, range)
}

// ============================================================================
// chat-window HTTP handlers (2026-06-06)
// ============================================================================

use crate::chat::types::{AddMessageReq, CreateSessionReq, UpdateSessionReq};

fn chat_err(e: impl std::fmt::Display) -> Response {
    json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

async fn chat_create_session_http(
    State(state): State<AppArc>,
    Json(req): Json<CreateSessionReq>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::create_session(&conn, &req.source, req.title.as_deref()) {
        Ok(s) => Json(s).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_list_sessions_http(
    State(state): State<AppArc>,
    Query(q): Query<ChatListQuery>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::list_sessions(
        &conn,
        q.source.as_deref(),
        q.saved_only.unwrap_or(false),
    ) {
        Ok(s) => Json(s).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_get_session_http(
    State(state): State<AppArc>,
    Path(id): Path<String>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::get_session(&conn, &id) {
        Ok(Some(s)) => Json(s).into_response(),
        Ok(None) => json_err(StatusCode::NOT_FOUND, "session not found"),
        Err(e) => chat_err(e),
    }
}

async fn chat_update_session_http(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    Json(req): Json<UpdateSessionReq>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::update_session(&conn, &id, req.title.as_deref(), req.is_saved) {
        Ok(()) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_delete_session_http(
    State(state): State<AppArc>,
    Path(id): Path<String>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::delete_session(&conn, &id) {
        Ok(()) => Json(serde_json::json!({"ok": true})).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_list_messages_http(
    State(state): State<AppArc>,
    Path(id): Path<String>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::list_messages(&conn, &id) {
        Ok(m) => Json(m).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_add_message_http(
    State(state): State<AppArc>,
    Path(id): Path<String>,
    Json(req): Json<AddMessageReq>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::add_message(
        &conn,
        &id,
        &req.role,
        &req.content,
        req.generation_id.as_deref(),
        req.voice_profile_id.as_deref(),
    ) {
        Ok(m) => Json(m).into_response(),
        Err(e) => chat_err(e),
    }
}

async fn chat_replay_message_http(
    State(state): State<AppArc>,
    Path((session_id, message_id)): Path<(String, String)>,
) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::message_generation_id(&conn, &message_id) {
        Ok(Some(gid)) => Json(serde_json::json!({
            "session_id": session_id,
            "message_id": message_id,
            "generation_id": gid,
        }))
        .into_response(),
        Ok(None) => json_err(StatusCode::NOT_FOUND, "message has no audio"),
        Err(e) => chat_err(e),
    }
}

async fn chat_list_sources_http(State(state): State<AppArc>) -> Response {
    let conn = state.db.conn();
    match crate::chat::db::list_recent_sources(&conn, 30 * 24 * 3600 * 1000) {
        Ok(s) => Json(s).into_response(),
        Err(e) => chat_err(e),
    }
}

#[derive(Debug, Deserialize)]
struct ChatListQuery {
    source: Option<String>,
    saved_only: Option<bool>,
}
