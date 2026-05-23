use anyhow::Result;
use std::sync::{Arc, OnceLock, RwLock};
use uuid::Uuid;

use crate::app_settings::AppSettings;
use crate::config::Config;
use crate::db::Db;
use crate::google::GoogleTts;
use crate::job_queue::JobQueue;
use crate::paths::AppPaths;
use crate::minimax::MinimaxClient;
use crate::voicebox::VoiceBoxClient;

pub struct AppState {
    pub paths: RwLock<AppPaths>,
    pub settings: RwLock<AppSettings>,
    pub settings_path: std::path::PathBuf,
    pub env_google_key: String,
    pub env_voicebox_url: String,
    pub env_minimax_key: String,
    pub db: Db,
    pub tts: GoogleTts,
    pub voicebox: VoiceBoxClient,
    pub minimax: MinimaxClient,
    pub session_id: String,
    pub job_queue: OnceLock<Arc<JobQueue>>,
}

impl AppState {
    pub fn initialize() -> Result<Self> {
        let cfg = Config::load()?;
        let env_google_key = cfg.google_api_key.clone();
        let env_voicebox_url = cfg.voicebox_base_url.clone();
        let env_minimax_key = cfg.minimax_api_key.clone();

        let mut paths = AppPaths::initialize()?;
        let settings_path = paths.settings_file.clone();
        let settings = AppSettings::load(&settings_path)?;
        paths.apply_settings(&settings);

        let db = Db::open(&paths.db)?;
        let tts = GoogleTts::new(settings.active_google_key(&env_google_key));
        let voicebox = VoiceBoxClient::new(settings.effective_voicebox_url(&env_voicebox_url));
        let minimax = MinimaxClient::new(settings.effective_minimax_key(&env_minimax_key));
        let session_id = Uuid::new_v4().to_string();

        // Mark any leftover queued/running rows from prior crash as interrupted.
        let _ = db.mark_orphans_interrupted();

        if let Ok(removed) = db.enforce_temp_retention(settings.temp_history_max, &session_id) {
            for p in removed {
                if !p.is_empty() {
                    let _ = std::fs::remove_file(&p);
                }
            }
        }

        let state = Self {
            paths: RwLock::new(paths),
            settings: RwLock::new(settings),
            settings_path,
            env_google_key,
            env_voicebox_url,
            env_minimax_key,
            db,
            tts,
            voicebox,
            minimax,
            session_id,
            job_queue: OnceLock::new(),
        };
        state.persist_settings()?;
        Ok(state)
    }

    pub fn job_queue(&self) -> Option<Arc<JobQueue>> {
        self.job_queue.get().cloned()
    }

    pub fn apply_and_save_settings(&self, mut settings: AppSettings) -> Result<()> {
        settings.normalize();
        let api_key = settings.active_google_key(&self.env_google_key);
        self.tts.set_api_key(api_key);

        self.voicebox
            .set_base_url(settings.effective_voicebox_url(&self.env_voicebox_url));
        self.minimax
            .set_api_key(settings.effective_minimax_key(&self.env_minimax_key));

        {
            let mut paths = self.paths.write().map_err(|e| anyhow::anyhow!("{e}"))?;
            paths.apply_settings(&settings);
        }

        let new_max = settings.max_concurrent_jobs;
        {
            let mut current = self.settings.write().map_err(|e| anyhow::anyhow!("{e}"))?;
            *current = settings;
        }
        if let Some(queue) = self.job_queue() {
            queue.set_max_concurrent(new_max);
        }

        self.persist_settings()
    }

    pub fn persist_settings(&self) -> Result<()> {
        let settings = self.settings.read().map_err(|e| anyhow::anyhow!("{e}"))?;
        settings.save(&self.settings_path)
    }

    /// Trims oldest prior-session temp rows when over `temp_history_max`; current session untouched.
    pub fn apply_temp_retention(&self) -> Result<()> {
        let max = self
            .settings
            .read()
            .map_err(|e| anyhow::anyhow!("{e}"))?
            .temp_history_max;
        let removed = self
            .db
            .enforce_temp_retention(max, &self.session_id)?;
        for p in removed {
            if !p.is_empty() {
                let _ = std::fs::remove_file(&p);
            }
        }
        Ok(())
    }
}
