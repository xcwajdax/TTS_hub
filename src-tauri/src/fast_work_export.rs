use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, AppHandle, Manager};

use crate::app_settings::PROVIDER_MINIMAX;
use crate::fast_work::config::FastWorkConfig;
use crate::paths::slugify_name;
use crate::portable_paths::{exe_dir, timestamp_folder_name};
use crate::state::AppState;
use crate::voice_profiles::find_voice_profile;

const BUNDLED_RESOURCE_DIR: &str = "fast-work";
const FAST_WORK_EXE_NAME: &str = "TTS Hub Fast Work.exe";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FastWorkExportResult {
    pub dest_dir: String,
    pub config_path: String,
    pub launcher_path: Option<String>,
}

pub fn export_portable(
    app: &AppHandle,
    state: &AppState,
    profile_id: &str,
    dest_parent: &Path,
    shortcut: Option<String>,
    env_minimax_key: &str,
) -> Result<FastWorkExportResult> {
    let settings = state.settings.read().map_err(|e| anyhow::anyhow!("{e}"))?;
    let profile = find_voice_profile(&settings.voice_profiles, Some(profile_id))
        .ok_or_else(|| anyhow::anyhow!("profil głosu nie istnieje: {profile_id}"))?
        .clone();

    if profile.provider != PROVIDER_MINIMAX {
        anyhow::bail!("Fast Work obsługuje wyłącznie profile MiniMax.");
    }

    let api_key = settings.effective_minimax_key(env_minimax_key);
    if api_key.trim().is_empty() {
        anyhow::bail!("Brak klucza MiniMax — ustaw go w Ustawieniach → Dostawcy.");
    }

    let bundle_src = locate_bundled_fast_work(app)?;
    if !bundle_src.is_dir() {
        anyhow::bail!(
            "Brak dołączonego pakietu Fast Work ({}). Zbuduj: npm run bundle:fast-work",
            bundle_src.display()
        );
    }

    let slug = slugify_name(&profile.name);
    let mut dest_dir = dest_parent.join(format!("{slug}-fast-work"));
    if dest_dir.exists() {
        dest_dir = dest_parent.join(format!("{slug}-fast-work-{}", timestamp_folder_name()));
    }
    fs::create_dir_all(&dest_dir).with_context(|| format!("create {}", dest_dir.display()))?;

    copy_dir_recursive(&bundle_src, &dest_dir)?;

    let profile_name = profile.name.clone();
    let config = FastWorkConfig {
        profile,
        minimax_api_key: api_key,
        save_format: settings.save_format.clone(),
        shortcut: shortcut.filter(|s| !s.trim().is_empty()),
        exported_at: chrono::Utc::now().timestamp_millis(),
        source_profile_name: profile_name,
    };
    let config_path = dest_dir.join("fast-work.json");
    config.save(&config_path)?;

    let launcher_path = write_launcher_bat(&dest_dir)?;

    Ok(FastWorkExportResult {
        dest_dir: dest_dir.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        launcher_path: Some(launcher_path.to_string_lossy().to_string()),
    })
}

fn locate_bundled_fast_work(app: &AppHandle) -> Result<PathBuf> {
    if let Ok(p) = app
        .path()
        .resolve(BUNDLED_RESOURCE_DIR, BaseDirectory::Resource)
    {
        if p.is_dir() {
            return Ok(p);
        }
    }
    if let Ok(p) = app.path().resolve(
        format!("../{BUNDLED_RESOURCE_DIR}"),
        BaseDirectory::Resource,
    ) {
        if p.is_dir() {
            return Ok(p);
        }
    }
    let exe = exe_dir()?;
    let sibling = exe.join(BUNDLED_RESOURCE_DIR);
    if sibling.is_dir() {
        return Ok(sibling);
    }
    Ok(exe.join("resources").join(BUNDLED_RESOURCE_DIR))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).with_context(|| {
                format!("copy {} → {}", from.display(), to.display())
            })?;
        }
    }
    Ok(())
}

fn write_launcher_bat(dest_dir: &Path) -> Result<PathBuf> {
    let bat_path = dest_dir.join("Uruchom Fast Work.bat");
    let exe = dest_dir.join(FAST_WORK_EXE_NAME);
    let content = format!(
        "@echo off\r\ncd /d \"%~dp0\"\r\nstart \"\" \"{}\"\r\n",
        exe.display()
    );
    fs::write(&bat_path, content)?;
    Ok(bat_path)
}
