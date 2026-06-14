use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

use crate::app_settings::AppSettings;
use crate::db::Folder;

pub struct AppPaths {
    pub root: PathBuf,
    pub settings_file: PathBuf,
    pub temp: PathBuf,
    pub archive: PathBuf,
    pub voice_samples: PathBuf,
    pub avatars: PathBuf,
    pub skins: PathBuf,
    pub skin_registry_cache: PathBuf,
    pub plugins: PathBuf,
    pub soundboard_storage: PathBuf,
    pub roleplay_projects: PathBuf,
    pub voicebox_data: PathBuf,
    pub db: PathBuf,
}

impl AppPaths {
    pub fn initialize() -> Result<Self> {
        let base = dirs_app_data().context("cannot resolve app data dir")?;
        let root = base.join("TTS_hub");
        let settings_file = root.join("settings.json");
        let temp = root.join("temp");
        let archive = root.join("archive");
        let voice_samples = root.join("voice_samples");
        let avatars = root.join("avatars");
        let skins = root.join("skins");
        let skin_registry_cache = root.join("skin_registry_cache");
        let plugins = root.join("plugins");
        let soundboard_storage = plugins.join("soundboard");
        let roleplay_projects = root.join("roleplay");
        let voicebox_data = root.join("voicebox");
        let db = root.join("history.db");

        std::fs::create_dir_all(&root)?;
        std::fs::create_dir_all(&temp)?;
        std::fs::create_dir_all(&archive)?;
        std::fs::create_dir_all(&voice_samples)?;
        std::fs::create_dir_all(&avatars)?;
        std::fs::create_dir_all(&skins)?;
        std::fs::create_dir_all(&skin_registry_cache)?;
        std::fs::create_dir_all(&plugins)?;
        std::fs::create_dir_all(&soundboard_storage)?;
        std::fs::create_dir_all(&roleplay_projects)?;
        std::fs::create_dir_all(&voicebox_data)?;

        Ok(Self {
            root,
            settings_file,
            temp,
            archive,
            voice_samples,
            avatars,
            skins,
            skin_registry_cache,
            plugins,
            soundboard_storage,
            roleplay_projects,
            voicebox_data,
            db,
        })
    }

    pub fn apply_settings(&mut self, settings: &AppSettings) {
        self.temp = settings
            .temp_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| self.root.join("temp"));
        self.archive = settings
            .archive_path
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| self.root.join("archive"));
        let _ = std::fs::create_dir_all(&self.temp);
        let _ = std::fs::create_dir_all(&self.archive);
    }

    /// Physical directory for an archive folder (`archive_path/<slug>/`).
    pub fn folder_dir(&self, folder: &Folder) -> PathBuf {
        self.archive.join(&folder.slug)
    }
}

/// Sanitize a display name into a filesystem-safe slug (lowercase ASCII, dashes).
pub fn slugify_name(name: &str) -> String {
    let mut slug = String::new();
    let mut prev_dash = true;
    for c in name.trim().to_lowercase().chars() {
        let ch = if c.is_ascii_alphanumeric() {
            c
        } else if c == ' ' || c == '-' || c == '_' {
            '-'
        } else {
            continue;
        };
        if ch == '-' {
            if !prev_dash {
                slug.push('-');
                prev_dash = true;
            }
        } else {
            slug.push(ch);
            prev_dash = false;
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "folder".to_string()
    } else {
        slug
    }
}

/// Ensure `slug` is unique among existing slugs by appending `-2`, `-3`, …
pub fn unique_slug(base: &str, existing: &[String]) -> String {
    if !existing.iter().any(|s| s == base) {
        return base.to_string();
    }
    for n in 2..=9999 {
        let candidate = format!("{base}-{n}");
        if !existing.iter().any(|s| s == &candidate) {
            return candidate;
        }
    }
    format!("{base}-{}", &uuid::Uuid::new_v4().to_string()[..8])
}

/// Rename a directory on disk; returns error if target exists.
pub fn rename_dir(from: &Path, to: &Path) -> Result<()> {
    if to.exists() {
        anyhow::bail!("target directory already exists");
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(from, to).context("rename folder directory")?;
    Ok(())
}

fn dirs_app_data() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        if let Ok(v) = std::env::var("APPDATA") {
            return Some(PathBuf::from(v));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join("Library/Application Support"));
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Ok(v) = std::env::var("XDG_DATA_HOME") {
            return Some(PathBuf::from(v));
        }
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join(".local/share"));
        }
    }
    None
}
