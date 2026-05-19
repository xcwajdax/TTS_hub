use anyhow::{anyhow, Context, Result};
use std::path::PathBuf;

pub struct Config {
    pub google_api_key: String,
}

impl Config {
    pub fn load() -> Result<Self> {
        for path in candidate_env_paths() {
            if path.exists() {
                let _ = dotenvy::from_path(&path);
                log::info!("Loaded env from {}", path.display());
                break;
            }
        }

        let google_api_key = std::env::var("GOOGLE_API_KEY")
            .context("GOOGLE_API_KEY missing. Put it in studios.env or .env at project root.")?;

        if google_api_key.trim().is_empty() {
            return Err(anyhow!("GOOGLE_API_KEY is empty"));
        }

        Ok(Self { google_api_key })
    }
}

fn candidate_env_paths() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        out.push(cwd.join("studios.env"));
        out.push(cwd.join(".env"));
        if let Some(parent) = cwd.parent() {
            out.push(parent.join("studios.env"));
            out.push(parent.join(".env"));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("studios.env"));
            out.push(dir.join(".env"));
            let mut p = dir.to_path_buf();
            for _ in 0..5 {
                if let Some(parent) = p.parent() {
                    out.push(parent.join("studios.env"));
                    out.push(parent.join(".env"));
                    p = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }
    out
}
