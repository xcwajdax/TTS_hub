//! Spawn / stop forked Voicebox backend (dev Python + release PyInstaller sidecar).

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use tauri::AppHandle;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

use crate::voicebox::VoiceBoxClient;

use super::process::{stop_process, VoiceboxServerProcess};
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

pub fn dev_venv_ready() -> bool {
    dev_backend_root()
        .and_then(|root| dev_python_executable(&root))
        .is_some()
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

fn spawn_dev_python(backend_root: &Path, host: &str, port: u16) -> Result<Child> {
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

#[cfg(not(debug_assertions))]
fn spawn_release_sidecar(
    app: &AppHandle,
    data_dir: &Path,
    port: u16,
) -> Result<VoiceboxServerProcess> {
    std::fs::create_dir_all(data_dir).with_context(|| format!("create {}", data_dir.display()))?;
    let sidecar = app
        .shell()
        .sidecar("voicebox-server")
        .context("voicebox-server sidecar not bundled — run scripts/build-voicebox-server.ps1 before tauri build")?;
    let parent_pid = std::process::id().to_string();
    let port_str = port.to_string();
    let data_dir_str = data_dir.to_string_lossy().to_string();
    let (_rx, child) = sidecar
        .args([
            "--data-dir",
            &data_dir_str,
            "--port",
            &port_str,
            "--parent-pid",
            &parent_pid,
            "--host",
            "127.0.0.1",
        ])
        .spawn()
        .context("spawn voicebox-server sidecar")?;
    Ok(VoiceboxServerProcess::Sidecar(child))
}

async fn wait_for_health(client: &VoiceBoxClient, attempts: u32) -> bool {
    for i in 0..attempts {
        if i > 0 {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        if client.health().await.is_ok() {
            return true;
        }
    }
    false
}

/// If already healthy, reuse. In bundled mode spawn dev Python (debug) or sidecar (release).
pub async fn ensure_running(
    client: &VoiceBoxClient,
    child_slot: &Mutex<Option<VoiceboxServerProcess>>,
    _app_handle: Option<&AppHandle>,
    _voicebox_data_dir: &Path,
    mode: VoiceboxServerMode,
    port: u16,
) -> VoiceboxServerStatus {
    let mut status = probe_server(client, 1).await;
    status.mode = mode.as_str().to_string();
    if status.reachable {
        status.message = Some("Reusing existing Voicebox server.".to_string());
        status.bundled_spawn_ready = true;
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
                    *guard = Some(VoiceboxServerProcess::Dev(child));
                }
                if wait_for_health(client, 45).await {
                    status = probe_server(client, 0).await;
                    status.mode = mode.as_str().to_string();
                    status.reachable = true;
                    status.bundled_spawn_ready = true;
                    status.message =
                        Some("Started forked Voicebox backend (dev Python).".to_string());
                    return status;
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

    #[cfg(not(debug_assertions))]
    if let Some(app) = _app_handle {
        match spawn_release_sidecar(app, _voicebox_data_dir, port) {
            Ok(proc) => {
                if let Ok(mut guard) = child_slot.lock() {
                    *guard = Some(proc);
                }
                if wait_for_health(client, 90).await {
                    status = probe_server(client, 0).await;
                    status.mode = mode.as_str().to_string();
                    status.reachable = true;
                    status.bundled_spawn_ready = true;
                    status.message =
                        Some("Started bundled voicebox-server sidecar.".to_string());
                    return status;
                }
                status.message = Some(
                    "Sidecar started but /health did not respond in time (first model load can be slow)."
                        .to_string(),
                );
                status.bundled_spawn_ready = true;
                return status;
            }
            Err(e) => {
                status.message = Some(format!("{e:#}"));
                return status;
            }
        }
    }

    #[cfg(debug_assertions)]
    {
        status.bundled_spawn_ready = dev_backend_root().is_some();
        status.message = Some(
            "Bundled sidecar binary not used in debug — use voicebox-backend/.venv or external server."
                .to_string(),
        );
    }
    #[cfg(not(debug_assertions))]
    {
        status.bundled_spawn_ready = false;
        status.message = Some(
            "Release build requires voicebox-server sidecar — run scripts/build-voicebox-server.ps1 before tauri build."
                .to_string(),
        );
    }
    status
}

pub fn stop_child(child_slot: &Mutex<Option<VoiceboxServerProcess>>) {
    stop_process(child_slot);
}

pub fn default_port() -> u16 {
    DEFAULT_PORT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_backend_root_exists_in_repo() {
        assert!(dev_backend_root().is_some());
    }
}
