use anyhow::{Context, Result};
use std::path::Path;
use std::sync::Arc;

use crate::db::STATUS_CANCELLED;
use crate::paths::AppPaths;
use crate::state::AppState;

/// Word the user must type to confirm destructive wipe (usually the computer name).
pub fn confirmation_word() -> String {
    resolve_confirmation_word().unwrap_or_else(|| "localhost".to_string())
}

fn resolve_confirmation_word() -> Option<String> {
    #[cfg(windows)]
    {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    if let Ok(name) = std::env::var("HOSTNAME") {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("scutil")
            .args(["--get", "ComputerName"])
            .output()
        {
            if out.status.success() {
                let trimmed = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
    }
    if let Ok(out) = std::process::Command::new("hostname").output() {
        if out.status.success() {
            let trimmed = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    None
}

pub fn confirmation_matches(input: &str, expected: &str) -> bool {
    let a = input.trim();
    let b = expected.trim();
    !a.is_empty() && a.eq_ignore_ascii_case(b)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearLocalDataResult {
    pub removed_generations: usize,
    pub bytes_removed: u64,
}

pub fn clear_all(state: &Arc<AppState>) -> Result<ClearLocalDataResult> {
    if let Some(queue) = state.job_queue() {
        for row in state.db.list_by_statuses(&["queued", "running"])? {
            queue.request_cancel(&row.id);
            let _ = state.db.update_status(&row.id, STATUS_CANCELLED, None);
        }
    }

    let removed_generations = state.db.count_generations()?;

    let paths = state.paths.read().map_err(|e| anyhow::anyhow!("{e}"))?;
    let mut bytes_removed = 0u64;
    for dir in directories_to_wipe(&paths) {
        bytes_removed = bytes_removed.saturating_add(clear_directory_contents(&dir)?);
        let _ = std::fs::create_dir_all(&dir);
    }
    drop(paths);

    state.db.clear_all_user_data()?;

    Ok(ClearLocalDataResult {
        removed_generations,
        bytes_removed,
    })
}

fn directories_to_wipe(paths: &AppPaths) -> Vec<std::path::PathBuf> {
    let mut dirs = vec![
        paths.temp.clone(),
        paths.archive.clone(),
        paths.voice_samples.clone(),
        paths.avatars.clone(),
        paths.skins.clone(),
        paths.skin_registry_cache.clone(),
    ];
    let default_temp = paths.root.join("temp");
    let default_archive = paths.root.join("archive");
    if paths.temp != default_temp {
        dirs.push(default_temp);
    }
    if paths.archive != default_archive {
        dirs.push(default_archive);
    }
    dirs.sort();
    dirs.dedup();
    dirs
}

fn clear_directory_contents(path: &Path) -> Result<u64> {
    if !path.is_dir() {
        return Ok(0);
    }
    let mut total = 0u64;
    for entry in std::fs::read_dir(path).with_context(|| format!("read_dir {}", path.display()))? {
        let entry = entry?;
        let p = entry.path();
        total = total.saturating_add(path_bytes(&p));
        if p.is_dir() {
            std::fs::remove_dir_all(&p).with_context(|| format!("remove_dir {}", p.display()))?;
        } else {
            std::fs::remove_file(&p).with_context(|| format!("remove_file {}", p.display()))?;
        }
    }
    Ok(total)
}

fn path_bytes(path: &Path) -> u64 {
    if path.is_file() {
        return std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }
    if !path.is_dir() {
        return 0;
    }
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            total = total.saturating_add(path_bytes(&entry.path()));
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirmation_matches_is_case_insensitive() {
        assert!(confirmation_matches("My-PC", "my-pc"));
        assert!(!confirmation_matches("", "my-pc"));
        assert!(!confirmation_matches("other", "my-pc"));
    }
}
