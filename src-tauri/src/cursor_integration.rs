use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::app_settings::{AppSettings, CursorIntegration};

/// Resolve `~/.cursor` (or platform equivalent).
pub fn cursor_dir() -> Result<PathBuf> {
    #[cfg(windows)]
    {
        let profile = std::env::var("USERPROFILE")
            .or_else(|_| {
                let drive = std::env::var("HOMEDRIVE").unwrap_or_default();
                let path = std::env::var("HOMEPATH").unwrap_or_default();
                if drive.is_empty() && path.is_empty() {
                    Err(std::env::VarError::NotPresent)
                } else {
                    Ok(format!("{drive}{path}"))
                }
            })
            .context("USERPROFILE not set")?;
        Ok(PathBuf::from(profile).join(".cursor"))
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").context("HOME not set")?;
        Ok(PathBuf::from(home).join(".cursor"))
    }
}

pub fn hooks_dir() -> Result<PathBuf> {
    Ok(cursor_dir()?.join("hooks"))
}

pub fn ps1_path() -> Result<PathBuf> {
    Ok(hooks_dir()?.join("cursor-tts.ps1"))
}

pub fn hooks_json_path() -> Result<PathBuf> {
    Ok(cursor_dir()?.join("hooks.json"))
}

pub fn tts_hub_config_path() -> Result<PathBuf> {
    Ok(cursor_dir()?.join("tts-hub.json"))
}

/// Locate the source `.cursor-hooks/cursor-tts.ps1` shipped with TTS Hub.
/// Tries (in order):
/// 1. `TTS_HUB_HOOKS_DIR` env var (dev / packaging override)
/// 2. `<exe_dir>/.cursor-hooks/`
/// 3. `<exe_dir>/../../.cursor-hooks/` (cargo target/debug → repo root)
/// 4. `<exe_dir>/../../../.cursor-hooks/` (cargo target/debug → src-tauri → repo root)
pub fn source_hooks_dir() -> Result<PathBuf> {
    if let Ok(v) = std::env::var("TTS_HUB_HOOKS_DIR") {
        let p = PathBuf::from(v);
        if p.join("cursor-tts.ps1").is_file() {
            return Ok(p);
        }
    }
    let exe = std::env::current_exe().context("current_exe")?;
    let exe_dir = exe.parent().context("exe has no parent")?;
    let candidates = [
        exe_dir.join(".cursor-hooks"),
        exe_dir.join("..").join(".cursor-hooks"),
        exe_dir.join("..").join("..").join(".cursor-hooks"),
        exe_dir.join("..").join("..").join("..").join(".cursor-hooks"),
    ];
    for c in &candidates {
        if c.join("cursor-tts.ps1").is_file() {
            return Ok(c.clone());
        }
    }
    Err(anyhow!(
        "could not locate .cursor-hooks/ alongside the executable; set TTS_HUB_HOOKS_DIR"
    ))
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationStatus {
    pub api_ok: bool,
    pub hooks_installed: bool,
    pub ps1_path: String,
    pub hooks_json_path: String,
    pub tts_hub_config_path: String,
    pub pwsh_available: bool,
    pub last_install_ts: Option<i64>,
    pub last_cursor_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallReport {
    pub copied_ps1: String,
    pub hooks_json: String,
    pub hooks_json_backup: Option<String>,
    pub tts_hub_config: String,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct UninstallReport {
    pub hooks_json: String,
    pub hooks_json_backup: Option<String>,
    pub removed_ps1: bool,
    pub removed_config: bool,
}

/// Check whether `pwsh` (PowerShell 7+) is on PATH.
pub fn pwsh_available() -> bool {
    let candidate = if cfg!(windows) { "pwsh.exe" } else { "pwsh" };
    std::process::Command::new(candidate)
        .arg("-NoLogo")
        .arg("-NoProfile")
        .arg("-Command")
        .arg("$PSVersionTable.PSVersion.Major")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn status() -> Result<IntegrationStatus> {
    let ps1 = ps1_path()?;
    let hooks_json = hooks_json_path()?;
    let cfg = tts_hub_config_path()?;
    let installed = ps1.is_file() && hooks_json_contains_our_hook(&hooks_json).unwrap_or(false);
    let last_install_ts = read_last_install_ts(&cfg).ok().flatten();
    Ok(IntegrationStatus {
        api_ok: true,
        hooks_installed: installed,
        ps1_path: ps1.to_string_lossy().to_string(),
        hooks_json_path: hooks_json.to_string_lossy().to_string(),
        tts_hub_config_path: cfg.to_string_lossy().to_string(),
        pwsh_available: pwsh_available(),
        last_install_ts,
        last_cursor_at: None,
    })
}

fn read_last_install_ts(cfg_path: &Path) -> Result<Option<i64>> {
    if !cfg_path.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(cfg_path)?;
    let v: serde_json::Value = serde_json::from_str(&raw)?;
    Ok(v.get("last_install_ts").and_then(|x| x.as_i64()))
}

fn hooks_json_contains_our_hook(path: &Path) -> Result<bool> {
    if !path.is_file() {
        return Ok(false);
    }
    let raw = std::fs::read_to_string(path)?;
    Ok(raw.contains("cursor-tts.ps1"))
}

/// Write `content` to `path` atomically (write `.tmp` + rename).
fn atomic_write(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension().and_then(|e| e.to_str()).unwrap_or("")
    ));
    std::fs::write(&tmp, content)?;
    // On Windows, rename fails if target exists; remove first.
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn export_tts_hub_config(cfg: &CursorIntegration, install_ts: Option<i64>) -> Result<PathBuf> {
    let path = tts_hub_config_path()?;
    let mut value = serde_json::to_value(cfg)?;
    if let Some(ts) = install_ts {
        if let Some(obj) = value.as_object_mut() {
            obj.insert("last_install_ts".to_string(), serde_json::json!(ts));
        }
    }
    atomic_write(&path, &serde_json::to_string_pretty(&value)?)?;
    Ok(path)
}

pub fn export_config(settings: &AppSettings) -> Result<PathBuf> {
    let install_ts = read_last_install_ts(&tts_hub_config_path()?).ok().flatten();
    export_tts_hub_config(&settings.cursor_integration, install_ts)
}

fn build_hook_entry(ps1: &Path) -> serde_json::Value {
    let pwsh = if cfg!(windows) { "pwsh.exe" } else { "pwsh" };
    serde_json::json!({
        "command": [
            pwsh,
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-File", ps1.to_string_lossy()
        ],
        "id": "tts-hub-cursor-integration"
    })
}

fn merge_hooks_json(existing: serde_json::Value, ps1: &Path) -> serde_json::Value {
    let mut root = match existing {
        serde_json::Value::Object(_) => existing,
        _ => serde_json::json!({}),
    };
    let obj = root.as_object_mut().expect("object");

    let mut entry_capture = build_hook_entry(ps1);
    if let Some(o) = entry_capture.as_object_mut() {
        o.insert("phase".to_string(), serde_json::json!("capture"));
    }
    let mut entry_speak = build_hook_entry(ps1);
    if let Some(o) = entry_speak.as_object_mut() {
        o.insert("phase".to_string(), serde_json::json!("speak"));
    }

    upsert_hook_array(obj, "afterAgentResponse", entry_capture);
    upsert_hook_array(obj, "stop", entry_speak);
    root
}

fn upsert_hook_array(
    obj: &mut serde_json::Map<String, serde_json::Value>,
    key: &str,
    entry: serde_json::Value,
) {
    let arr = obj
        .entry(key.to_string())
        .or_insert_with(|| serde_json::Value::Array(Vec::new()));
    let arr = match arr {
        serde_json::Value::Array(a) => a,
        _ => return,
    };
    let entry_id = entry.get("id").and_then(|x| x.as_str()).unwrap_or("");
    let pos = arr.iter().position(|item| {
        item.get("id").and_then(|x| x.as_str()) == Some(entry_id)
            || item
                .get("command")
                .and_then(|c| {
                    if let Some(s) = c.as_str() {
                        Some(s.contains("cursor-tts.ps1"))
                    } else if let Some(a) = c.as_array() {
                        Some(a.iter().any(|p| {
                            p.as_str().map(|s| s.contains("cursor-tts.ps1")).unwrap_or(false)
                        }))
                    } else {
                        None
                    }
                })
                .unwrap_or(false)
    });
    if let Some(i) = pos {
        arr[i] = entry;
    } else {
        arr.push(entry);
    }
}

pub fn install_hooks(settings: &AppSettings) -> Result<InstallReport> {
    if !pwsh_available() {
        return Err(anyhow!(
            "PowerShell 7+ (pwsh) was not found on PATH. Install from https://aka.ms/powershell and retry."
        ));
    }

    let src_dir = source_hooks_dir()?;
    let src_ps1 = src_dir.join("cursor-tts.ps1");
    if !src_ps1.is_file() {
        return Err(anyhow!(
            "source script missing: {}",
            src_ps1.to_string_lossy()
        ));
    }

    let dst_ps1 = ps1_path()?;
    if let Some(parent) = dst_ps1.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(&src_ps1, &dst_ps1)
        .with_context(|| format!("copy {} -> {}", src_ps1.display(), dst_ps1.display()))?;

    let hooks_json = hooks_json_path()?;
    let mut backup: Option<String> = None;
    let existing: serde_json::Value = if hooks_json.is_file() {
        let raw = std::fs::read_to_string(&hooks_json)?;
        let ts = chrono::Utc::now().timestamp();
        let bak = hooks_json.with_extension(format!("json.{}.bak", ts));
        std::fs::write(&bak, &raw)?;
        backup = Some(bak.to_string_lossy().to_string());
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let merged = merge_hooks_json(existing, &dst_ps1);
    atomic_write(&hooks_json, &serde_json::to_string_pretty(&merged)?)?;

    let ts = chrono::Utc::now().timestamp_millis();
    let cfg_path = export_tts_hub_config(&settings.cursor_integration, Some(ts))?;

    Ok(InstallReport {
        copied_ps1: dst_ps1.to_string_lossy().to_string(),
        hooks_json: hooks_json.to_string_lossy().to_string(),
        hooks_json_backup: backup,
        tts_hub_config: cfg_path.to_string_lossy().to_string(),
        ts,
    })
}

pub fn uninstall_hooks(remove_script: bool, remove_config: bool) -> Result<UninstallReport> {
    let hooks_json = hooks_json_path()?;
    let mut backup: Option<String> = None;
    if hooks_json.is_file() {
        let raw = std::fs::read_to_string(&hooks_json)?;
        let ts = chrono::Utc::now().timestamp();
        let bak = hooks_json.with_extension(format!("json.{}.bak", ts));
        std::fs::write(&bak, &raw)?;
        backup = Some(bak.to_string_lossy().to_string());

        let mut v: serde_json::Value =
            serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        if let Some(obj) = v.as_object_mut() {
            for key in ["afterAgentResponse", "stop"] {
                if let Some(serde_json::Value::Array(arr)) = obj.get_mut(key) {
                    arr.retain(|item| {
                        let by_id = item.get("id").and_then(|x| x.as_str())
                            != Some("tts-hub-cursor-integration");
                        let by_cmd = item
                            .get("command")
                            .and_then(|c| {
                                if let Some(s) = c.as_str() {
                                    Some(!s.contains("cursor-tts.ps1"))
                                } else if let Some(a) = c.as_array() {
                                    Some(!a.iter().any(|p| {
                                        p.as_str().map(|s| s.contains("cursor-tts.ps1")).unwrap_or(false)
                                    }))
                                } else {
                                    None
                                }
                            })
                            .unwrap_or(true);
                        by_id && by_cmd
                    });
                }
            }
        }
        atomic_write(&hooks_json, &serde_json::to_string_pretty(&v)?)?;
    }

    let mut removed_ps1 = false;
    if remove_script {
        let p = ps1_path()?;
        if p.is_file() {
            std::fs::remove_file(&p)?;
            removed_ps1 = true;
        }
    }
    let mut removed_config = false;
    if remove_config {
        let p = tts_hub_config_path()?;
        if p.is_file() {
            std::fs::remove_file(&p)?;
            removed_config = true;
        }
    }

    Ok(UninstallReport {
        hooks_json: hooks_json.to_string_lossy().to_string(),
        hooks_json_backup: backup,
        removed_ps1,
        removed_config,
    })
}
