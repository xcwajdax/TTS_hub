//! Local Voicebox backend lifecycle (bundled sidecar).
//! Spawn/binary bundling lands in a later milestone; this module exposes mode + health polling.

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::voicebox::VoiceBoxClient;

/// How TTS Hub connects to the Voicebox FastAPI server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VoiceboxServerMode {
    /// User runs Voicebox (or external server) — current default.
    External,
    /// TTS Hub spawns bundled ttshub-local-server (future).
    Bundled,
    /// Voicebox provider disabled.
    Disabled,
}

impl Default for VoiceboxServerMode {
    fn default() -> Self {
        Self::External
    }
}

impl VoiceboxServerMode {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "bundled" => Self::Bundled,
            "disabled" => Self::Disabled,
            _ => Self::External,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::External => "external",
            Self::Bundled => "bundled",
            Self::Disabled => "disabled",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct VoiceboxServerStatus {
    pub mode: String,
    pub base_url: String,
    pub reachable: bool,
    pub health_status: Option<String>,
    pub bundled_spawn_ready: bool,
    pub message: Option<String>,
}

/// Poll `/health` with retries. Does not spawn a process.
pub async fn probe_server(client: &VoiceBoxClient, retries: u32) -> VoiceboxServerStatus {
    let base_url = client.base_url();
    let mut last_err: Option<String> = None;
    for attempt in 0..=retries {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        match client.health().await {
            Ok(h) => {
                return VoiceboxServerStatus {
                    mode: VoiceboxServerMode::External.as_str().to_string(),
                    base_url,
                    reachable: true,
                    health_status: Some(h.status),
                    bundled_spawn_ready: false,
                    message: None,
                };
            }
            Err(e) => last_err = Some(format!("{e:#}")),
        }
    }
    VoiceboxServerStatus {
        mode: VoiceboxServerMode::External.as_str().to_string(),
        base_url,
        reachable: false,
        health_status: None,
        bundled_spawn_ready: false,
        message: last_err,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_mode() {
        assert_eq!(VoiceboxServerMode::parse("bundled"), VoiceboxServerMode::Bundled);
        assert_eq!(VoiceboxServerMode::parse("external"), VoiceboxServerMode::External);
        assert_eq!(VoiceboxServerMode::parse(""), VoiceboxServerMode::External);
    }
}
