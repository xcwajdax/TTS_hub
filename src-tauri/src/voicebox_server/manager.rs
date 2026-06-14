//! Spawn / stop forked Voicebox backend (dev Python today; PyInstaller sidecar later).

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};

use crate::voicebox::VoiceBoxClient;

use super::{probe_server, VoiceboxServerMode, VoiceboxServerStatus};

const DEFAULT_PORT: u16 = 17493;

/// Repo-relative `voicebox-backend/` when running `cargo tauri dev`.
pub fn dev_backend_root() -> Option<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest.join("..").join("voicebox-backend");
    if root.join("backend").join("main.py").is_file() {
        Some(root.canonicalize().unwrap_or(root))
    } else {
        None
    }
}

fn dev_python_executable(backend_root: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let py = backend_root.join(".venv").join("Scripts").join("python.exe");
        if py.is_file() {
            return Some(py);
        }
    }
    #[cfg(not(windows))]
    {
        let py = backend_root.join(".venv").join("bin").join("python");
        if py.is_file() {
            return Some(py);
        }
    }
    None
}

pub fn spawn_dev_python(backend_root: &Path, host: &str, port: u16) -> Result<Child> {
    let python = dev_python_executable(backend_root).ok_or_else(|| {
        anyhow!(
            "voicebox-backend/.venv not found — run: cd voicebox-backend && python -m venv .venv && pip install -r backend/requirements.txt"
        )
    })?;
    let mut cmd = Command::new(&python);
    cmd.current_dir(backend_root)
        .env("PYTHONPATH", backend_root)
        .args([
            "-m",
            "backend.main",
            "--host",
            host,
            "--port",
            &port.to_string(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    cmd.spawn()
        .with_context(|| format!("spawn Voicebox dev server via {}", python.display()))
}

pub fn stop_child(child_slot: &Mutex<Option<Child>>) {
    if let Ok(mut guard) = child_slot.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// If already healthy, reuse. In bundled mode, spawn dev Python when building in debug.
pub async fn ensure_running(
    client: &VoiceBoxClient,
    child_slot: &Mutex<Option<Child>>,
    mode: VoiceboxServerMode,
    port: u16,
) -> VoiceboxServerStatus {
    let _base_url = format!("http://127.0.0.1:{port}");
    let mut status = probe_server(client, 1).await;
    status.mode = mode.as_str().to_string();
    if status.reachable {
        status.message = Some("Reusing existing Voicebox server.".to_string());
        return status;
    }

    if mode != VoiceboxServerMode::Bundled {
        return status;
    }

    #[cfg(debug_assertions)]
    if let Some(root) = dev_backend_root() {
        match spawn_dev_python(&root, "127.0.0.1", port) {
            Ok(child) => {
                if let Ok(mut guard) = child_slot.lock() {
                    *guard = Some(child);
                }
                for _ in 0..45 {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    status = probe_server(client, 0).await;
                    status.mode = mode.as_str().to_string();
                    if status.reachable {
                        status.message =
                            Some("Started forked Voicebox backend (dev Python).".to_string());
                        status.bundled_spawn_ready = true;
                        return status;
                    }
                }
                status.message = Some(
                    "Spawned dev Voicebox backend but /health did not respond in time.".to_string(),
                );
                return status;
            }
            Err(e) => {
                status.message = Some(format!("{e:#}"));
                return status;
            }
        }
    }

    status.bundled_spawn_ready = false;
    status.message = Some(
        "Bundled sidecar binary not yet shipped. Use external Voicebox or dev venv (see voicebox-backend/README.md)."
            .to_string(),
    );
    status
}

pub fn default_port() -> u16 {
    DEFAULT_PORT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_backend_root_exists_in_repo() {
        // When tests run from src-tauri, voicebox-backend should be present on fork branch.
        assert!(dev_backend_root().is_some());
    }
}
