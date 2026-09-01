//! Ring buffer of Voicebox server stdout/stderr for the Hub Log UI.

use std::collections::VecDeque;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const MAX_LINES: usize = 1000;
const MAX_LINE_CHARS: usize = 4000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceboxLogLine {
    pub line: String,
    pub stream: String,
    pub ts: String,
}

pub struct VoiceboxLogBuffer {
    lines: Mutex<VecDeque<VoiceboxLogLine>>,
}

impl VoiceboxLogBuffer {
    pub fn new() -> Self {
        Self {
            lines: Mutex::new(VecDeque::with_capacity(256)),
        }
    }

    pub fn clear(&self) {
        if let Ok(mut g) = self.lines.lock() {
            g.clear();
        }
    }

    pub fn snapshot(&self) -> Vec<VoiceboxLogLine> {
        self.lines
            .lock()
            .map(|g| g.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub fn push_line(&self, app: Option<&AppHandle>, stream: &str, raw: &str) {
        let trimmed = raw.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            return;
        }
        let line = if trimmed.chars().count() > MAX_LINE_CHARS {
            let truncated: String = trimmed.chars().take(MAX_LINE_CHARS).collect();
            format!("{truncated}…")
        } else {
            trimmed.to_string()
        };
        let entry = VoiceboxLogLine {
            line,
            stream: stream.to_string(),
            ts: chrono_like_now(),
        };
        if let Ok(mut g) = self.lines.lock() {
            while g.len() >= MAX_LINES {
                g.pop_front();
            }
            g.push_back(entry.clone());
        }
        if let Some(app) = app {
            let _ = app.emit("voicebox-server-log", &entry);
        }
    }

    pub fn push_marker(&self, app: Option<&AppHandle>, message: &str) {
        self.push_line(app, "system", message);
    }
}

impl Default for VoiceboxLogBuffer {
    fn default() -> Self {
        Self::new()
    }
}

fn chrono_like_now() -> String {
    chrono::Local::now().format("%H:%M:%S").to_string()
}
