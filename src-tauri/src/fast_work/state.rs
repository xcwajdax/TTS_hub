use anyhow::Result;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use tauri::AppHandle;
use uuid::Uuid;

use crate::fast_work::config::{FastWorkConfig, FastWorkGeneration};
use crate::minimax::MinimaxClient;
use crate::portable_paths::PortablePaths;

pub struct FastWorkState {
    pub paths: PortablePaths,
    pub config: RwLock<FastWorkConfig>,
    pub minimax: MinimaxClient,
    pub session_history: RwLock<Vec<FastWorkGeneration>>,
    pub output_dir: RwLock<std::path::PathBuf>,
    pub session_id: String,
    pub generation_seq: AtomicU32,
    pub app_handle: OnceLock<AppHandle>,
    pub generating: RwLock<bool>,
}

impl FastWorkState {
    pub fn initialize() -> Result<Self> {
        let paths = PortablePaths::initialize()?;
        if !paths.config_file.is_file() {
            anyhow::bail!(
                "Brak pliku {} obok aplikacji. Wyeksportuj Fast Work z głównej aplikacji TTS Hub.",
                paths.config_file.display()
            );
        }
        let config = FastWorkConfig::load(&paths.config_file)?;
        if config.profile.provider != "minimax" {
            anyhow::bail!("Fast Work obsługuje wyłącznie profile MiniMax.");
        }
        if config.minimax_api_key.trim().is_empty() {
            anyhow::bail!("Brak klucza MiniMax w konfiguracji Fast Work.");
        }

        let output_dir = paths.default_output_session_dir();
        paths.ensure_output_dir(&output_dir)?;

        let minimax = MinimaxClient::new(config.minimax_api_key.clone());

        Ok(Self {
            paths,
            config: RwLock::new(config),
            minimax,
            session_history: RwLock::new(Vec::new()),
            output_dir: RwLock::new(output_dir),
            session_id: Uuid::new_v4().to_string(),
            generation_seq: AtomicU32::new(0),
            app_handle: OnceLock::new(),
            generating: RwLock::new(false),
        })
    }

    pub fn next_file_stem(&self) -> String {
        let n = self.generation_seq.fetch_add(1, Ordering::SeqCst) + 1;
        format!("{n:03}")
    }

    pub fn persist_config(&self) -> Result<()> {
        let cfg = self.config.read().map_err(|e| anyhow::anyhow!("{e}"))?;
        cfg.save(&self.paths.config_file)
    }
}

pub type FastWorkArc = Arc<FastWorkState>;
