use anyhow::{Context, Result};
use chrono::Local;
use std::path::{Path, PathBuf};

pub const CONFIG_FILE: &str = "fast-work.json";

pub struct PortablePaths {
    pub exe_dir: PathBuf,
    pub config_file: PathBuf,
    pub output_root: PathBuf,
}

impl PortablePaths {
    pub fn initialize() -> Result<Self> {
        let exe_dir = exe_dir()?;
        let config_file = exe_dir.join(CONFIG_FILE);
        let output_root = exe_dir.join("output");
        std::fs::create_dir_all(&output_root)?;
        Ok(Self {
            exe_dir,
            config_file,
            output_root,
        })
    }

    pub fn default_output_session_dir(&self) -> PathBuf {
        let stamp = Local::now().format("%Y-%m-%d_%H-%M-%S");
        self.output_root.join(stamp.to_string())
    }

    pub fn ensure_output_dir(&self, dir: &Path) -> Result<()> {
        std::fs::create_dir_all(dir).with_context(|| format!("cannot create {}", dir.display()))
    }
}

pub fn exe_dir() -> Result<PathBuf> {
    let exe = std::env::current_exe().context("current_exe")?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .context("exe has no parent directory")
}

pub fn timestamp_folder_name() -> String {
    Local::now().format("%Y-%m-%d_%H-%M-%S").to_string()
}
