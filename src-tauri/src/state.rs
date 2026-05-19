use anyhow::Result;
use std::sync::RwLock;
use uuid::Uuid;

use crate::app_settings::AppSettings;
use crate::config::Config;
use crate::db::Db;
use crate::google::GoogleTts;
use crate::paths::AppPaths;

pub struct AppState {
    pub paths: RwLock<AppPaths>,
    pub settings: RwLock<AppSettings>,
    pub settings_path: std::path::PathBuf,
    pub env_google_key: String,
    pub db: Db,
    pub tts: GoogleTts,
    pub session_id: String,
}

impl AppState {
    pub fn initialize() -> Result<Self> {
        let cfg = Config::load()?;
        let env_google_key = cfg.google_api_key.clone();

        let mut paths = AppPaths::initialize()?;
        let settings_path = paths.settings_file.clone();
        let settings = AppSettings::load(&settings_path)?;
        paths.apply_settings(&settings);

        let db = Db::open(&paths.db)?;
        let tts = GoogleTts::new(settings.active_google_key(&env_google_key));
        let session_id = Uuid::new_v4().to_string();

        if let Ok(removed) = db.cleanup_non_archived_from_other_sessions(&session_id) {
            for p in removed {
                let _ = std::fs::remove_file(&p);
            }
        }

        let state = Self {
            paths: RwLock::new(paths),
            settings: RwLock::new(settings),
            settings_path,
            env_google_key,
            db,
            tts,
            session_id,
        };
        state.persist_settings()?;
        Ok(state)
    }

    pub fn apply_and_save_settings(&self, mut settings: AppSettings) -> Result<()> {
        settings.normalize();
        let api_key = settings.active_google_key(&self.env_google_key);
        self.tts.set_api_key(api_key);

        {
            let mut paths = self.paths.write().map_err(|e| anyhow::anyhow!("{e}"))?;
            paths.apply_settings(&settings);
        }

        {
            let mut current = self.settings.write().map_err(|e| anyhow::anyhow!("{e}"))?;
            *current = settings;
        }

        self.persist_settings()
    }

    pub fn persist_settings(&self) -> Result<()> {
        let settings = self.settings.read().map_err(|e| anyhow::anyhow!("{e}"))?;
        settings.save(&self.settings_path)
    }
}
