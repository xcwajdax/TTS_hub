use anyhow::Result;
use std::path::PathBuf;

pub struct Config {
    pub google_api_key: String,
    pub voicebox_base_url: String,
    pub minimax_api_key: String,
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

        let google_api_key = std::env::var("GOOGLE_API_KEY").unwrap_or_default();

        let voicebox_base_url = std::env::var("VOICEBOX_BASE_URL")
            .or_else(|_| std::env::var("VOICEBOX_URL"))
            .unwrap_or_else(|_| "http://127.0.0.1:17493".to_string());

        let minimax_api_key = std::env::var("MINIMAX_API_KEY").unwrap_or_default();

        Ok(Self {
            google_api_key,
            voicebox_base_url,
            minimax_api_key,
        })
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
