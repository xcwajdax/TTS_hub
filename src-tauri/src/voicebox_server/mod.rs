//! Local Voicebox backend lifecycle (bundled sidecar).

mod install;
mod log;
mod manager;
mod process;

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub use install::{install_available, install_dev_backend, is_installing};
pub use log::{VoiceboxLogBuffer, VoiceboxLogLine};
pub use manager::{default_port, dev_venv_ready, ensure_running, stop_child};
pub use process::VoiceboxServerProcess;

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
    /// Dev: `voicebox-backend/.venv` exists and has a Python interpreter.
    pub dev_venv_ready: bool,
    /// Dev: fork checkout present — can run in-app `voicebox_server_install`.
    pub dev_install_available: bool,
    pub installing: bool,
    pub message: Option<String>,
}

pub fn fill_install_flags(status: &mut VoiceboxServerStatus) {
    status.dev_venv_ready = manager::dev_venv_ready();
    status.dev_install_available = install_available();
    status.installing = is_installing();
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
                let mut status = VoiceboxServerStatus {
                    mode: VoiceboxServerMode::External.as_str().to_string(),
                    base_url,
                    reachable: true,
                    health_status: Some(h.status),
                    bundled_spawn_ready: false,
                    dev_venv_ready: false,
                    dev_install_available: false,
                    installing: false,
                    message: None,
                };
                fill_install_flags(&mut status);
                return status;
            }
            Err(e) => last_err = Some(format!("{e:#}")),
        }
    }
    let mut status = VoiceboxServerStatus {
        mode: VoiceboxServerMode::External.as_str().to_string(),
        base_url,
        reachable: false,
        health_status: None,
        bundled_spawn_ready: false,
        dev_venv_ready: false,
        dev_install_available: false,
        installing: false,
        message: last_err,
    };
    fill_install_flags(&mut status);
    status
}

/// Whether bundled spawn can work in this build (dev venv or release sidecar binary).
pub fn bundled_spawn_ready(app: Option<&AppHandle>) -> bool {
    if dev_venv_ready() {
        return true;
    }
    app.and_then(|a| a.shell().sidecar("voicebox-server").ok())
        .is_some()
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
