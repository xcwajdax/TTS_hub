use anyhow::{Context, Result};
use std::path::Path;
use std::sync::Arc;

use crate::db::STATUS_CANCELLED;
use crate::paths::AppPaths;
use crate::plugins::soundboard::SoundboardSettings;
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
    !a.is_empty() && a.to_lowercase() == b.to_lowercase()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearLocalDataResult {
    pub removed_generations: usize,
    pub bytes_removed: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCategoryStats {
    pub id: String,
    pub bytes: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStorageStats {
    pub root_path: String,
    pub db_path: String,
    pub db_bytes: u64,
    pub settings_bytes: u64,
    pub total_bytes: u64,
    pub generation_count: usize,
    pub chat_session_count: usize,
    pub roleplay_project_count: usize,
    pub categories: Vec<StorageCategoryStats>,
}

pub fn compute_stats(state: &Arc<AppState>) -> Result<LocalStorageStats> {
    let paths = state.paths.read().map_err(|e| anyhow::anyhow!("{e}"))?;
    let generation_count = state.db.count_generations()?;
    let chat_session_count = state.db.count_chat_sessions()?;
    let roleplay_project_count = state.db.count_roleplay_projects()?;

    let mut categories = vec![
        category_stats("temp", &paths.temp),
        category_stats("archive", &paths.archive),
        category_stats("voice_samples", &paths.voice_samples),
        category_stats("avatars", &paths.avatars),
        category_stats("skins", &paths.skins),
        category_stats("skin_registry_cache", &paths.skin_registry_cache),
        category_stats("soundboard", &paths.soundboard_storage),
        category_stats("roleplay", &paths.roleplay_projects),
    ];

    let default_temp = paths.root.join("temp");
    let default_archive = paths.root.join("archive");
    if paths.temp != default_temp {
        merge_category(&mut categories, "temp_legacy", &default_temp);
    }
    if paths.archive != default_archive {
        merge_category(&mut categories, "archive_legacy", &default_archive);
    }

    let db_bytes = file_size(&paths.db);
    let settings_bytes = file_size(&paths.settings_file);
    let total_bytes = categories.iter().map(|c| c.bytes).sum::<u64>() + db_bytes;

    Ok(LocalStorageStats {
        root_path: paths.root.display().to_string(),
        db_path: paths.db.display().to_string(),
        db_bytes,
        settings_bytes,
        total_bytes,
        generation_count,
        chat_session_count,
        roleplay_project_count,
        categories,
    })
}

fn merge_category(categories: &mut Vec<StorageCategoryStats>, id: &str, path: &Path) {
    let (bytes, file_count) = dir_stats(path);
    if bytes == 0 && file_count == 0 {
        return;
    }
    categories.push(StorageCategoryStats {
        id: id.to_string(),
        bytes,
        file_count,
    });
}

fn category_stats(id: &str, path: &Path) -> StorageCategoryStats {
    let (bytes, file_count) = dir_stats(path);
    StorageCategoryStats {
        id: id.to_string(),
        bytes,
        file_count,
    }
}

fn dir_stats(path: &Path) -> (u64, u64) {
    if !path.is_dir() {
        return (0, 0);
    }
    let mut bytes = 0u64;
    let mut files = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let (b, f) = path_entry_stats(&entry.path());
            bytes = bytes.saturating_add(b);
            files = files.saturating_add(f);
        }
    }
    (bytes, files)
}

fn path_entry_stats(path: &Path) -> (u64, u64) {
    if path.is_file() {
        return (file_size(path), 1);
    }
    if path.is_dir() {
        let (bytes, files) = dir_stats(path);
        return (bytes, files);
    }
    (0, 0)
}

fn file_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

pub fn clear_all(state: &Arc<AppState>) -> Result<ClearLocalDataResult> {
    if let Some(queue) = state.job_queue() {
        for row in state.db.list_by_statuses(&["queued", "running"])? {
            queue.request_cancel(&row.id);
            let _ = state.db.update_status(&row.id, STATUS_CANCELLED, None);
        }
    }

    if let Some(roleplay_q) = state.roleplay_queue.get() {
        if let Ok(projects) = state.db.roleplay_list_projects() {
            for project in projects {
                roleplay_q.cancel(&project.id);
            }
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

    {
        let default_sb = SoundboardSettings::default();
        let mut sb = state.soundboard.write().map_err(|e| anyhow::anyhow!("{e}"))?;
        *sb = default_sb.clone();
        state.persist_soundboard(&default_sb)?;
    }

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
        paths.soundboard_storage.clone(),
        paths.roleplay_projects.clone(),
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
        let (bytes, _) = path_entry_stats(&p);
        total = total.saturating_add(bytes);
        if p.is_dir() {
            std::fs::remove_dir_all(&p).with_context(|| format!("remove_dir {}", p.display()))?;
        } else {
            std::fs::remove_file(&p).with_context(|| format!("remove_file {}", p.display()))?;
        }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirmation_matches_is_case_insensitive() {
        assert!(confirmation_matches("My-PC", "my-pc"));
        assert!(confirmation_matches("ąćę", "ĄĆĘ"));
        assert!(!confirmation_matches("", "my-pc"));
        assert!(!confirmation_matches("other", "my-pc"));
    }
}
