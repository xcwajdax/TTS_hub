//! Chat session and message types.
//!
//! One chat_session = one conversation with one source (Hermes, Cursor, OpenCode, etc.).
//! chat_messages belong to a session, ordered by `order_index`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub source: String,
    pub title: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub is_saved: bool,
    pub message_count: i64,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    /// "user" | "assistant" | "system"
    pub role: String,
    pub content: String,
    pub generation_id: Option<String>,
    pub created_at: i64,
    pub order_index: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSessionReq {
    pub source: String,
    pub title: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSessionReq {
    pub title: Option<String>,
    pub is_saved: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddMessageReq {
    pub role: String,
    pub content: String,
    pub generation_id: Option<String>,
}
