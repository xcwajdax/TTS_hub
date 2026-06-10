//! Chat window module — sessions and messages per source.
//!
//! Used by:
//! - `chat::commands` (Tauri IPC: `chat_*` commands)
//! - `http_api` (HTTP routes: `/chat/*`)
//! - The frontend ChatView tab (4th tab in AppViewTabs).

pub mod db;
pub mod types;
pub mod commands;
