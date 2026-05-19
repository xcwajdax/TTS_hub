use anyhow::{Context, Result};
use std::path::PathBuf;

use crate::app_settings::AppSettings;

pub struct AppPaths {
    pub root: PathBuf,
    pub settings_file: PathBuf,
    pub temp: PathBuf,
    pub archive: PathBuf,
    pub voice_samples: PathBuf,
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
        let db = root.join("history.db");

        std::fs::create_dir_all(&root)?;
        std::fs::create_dir_all(&temp)?;
        std::fs::create_dir_all(&archive)?;
        std::fs::create_dir_all(&voice_samples)?;

        Ok(Self {
            root,
            settings_file,
            temp,
            archive,
            voice_samples,
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
