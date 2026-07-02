use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::avatars::{avatar_info, voice_avatar_path};
use crate::paths::AppPaths;
use crate::state::AppState;
use crate::voice_profiles::TtsVoiceProfile;
use crate::voice_samples::{sample_path, SAMPLE_TEXT};

const EMBEDDED_CATALOG: &str = include_str!("../../docs/voice-packs/catalog.json");

pub const FORMAT: &str = "ttshub-voicepack";
pub const FORMAT_VERSION: u32 = 1;
const MAX_ARCHIVE_BYTES: u64 = 8 * 1024 * 1024;
const MANIFEST_NAME: &str = "manifest.json";
const PREVIEW_WAV: &str = "preview.wav";
const PREVIEW_MP3: &str = "preview.mp3";
const AVATAR_PNG: &str = "avatar.png";

const ALLOWED_EXTENSIONS: &[&str] = &["json", "wav", "mp3", "png", "jpg", "jpeg", "webp", "txt", "md"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePackCatalog {
    pub format: String,
    pub format_version: u32,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub raw_base: Option<String>,
    pub packs: Vec<VoicePackCatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePackCatalogEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub preview_url: Option<String>,
    #[serde(default)]
    pub download_path: Option<String>,
    #[serde(default)]
    pub folder: Option<String>,
}

pub fn embedded_catalog() -> Result<VoicePackCatalog> {
    serde_json::from_str(EMBEDDED_CATALOG).context("parse embedded voice pack catalog")
}

pub fn persist_imported_profile(state: &AppState, mut profile: TtsVoiceProfile) -> Result<TtsVoiceProfile> {
    profile.normalize();
    let mut settings = state.settings.read().map_err(|e| anyhow!("{e}"))?.clone();
    settings.voice_profiles.push(profile.clone());
    state.apply_and_save_settings(settings)?;
    Ok(profile)
}

fn apply_recommended_filter_preset(state: &AppState, preset_id: &str) -> Result<()> {
    let preset_id = preset_id.trim();
    if preset_id.is_empty() {
        return Ok(());
    }
    let mut settings = state.settings.read().map_err(|e| anyhow!("{e}"))?.clone();
    settings.text_filters.active_preset_id = Some(preset_id.to_string());
    settings.text_filters.normalize();
    state.apply_and_save_settings(settings)?;
    Ok(())
}

pub fn import_and_persist_profile(state: &AppState, archive_path: &Path) -> Result<TtsVoiceProfile> {
    let (manifest, profile) = import_voice_pack(archive_path)?;
    let profile = persist_imported_profile(state, profile)?;
    if let Some(filter_id) = manifest.recommended_filter_preset_id.as_deref() {
        apply_recommended_filter_preset(state, filter_id)?;
    }
    Ok(profile)
}

pub async fn import_and_persist_profile_from_url(
    state: &AppState,
    url: &str,
) -> Result<TtsVoiceProfile> {
    let url = url.trim();
    if url.is_empty() {
        return Err(anyhow!("url is required"));
    }
    let tmp = {
        let paths = state.paths.read().map_err(|e| anyhow!("{e}"))?;
        paths
            .temp
            .join(format!("voice-pack-{}.zip", Uuid::new_v4()))
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .context("http client")?;
    let bytes = client
        .get(url)
        .send()
        .await
        .context("download voice pack")?
        .error_for_status()
        .context("voice pack download status")?
        .bytes()
        .await
        .context("voice pack body")?;
    if bytes.len() as u64 > MAX_ARCHIVE_BYTES {
        return Err(anyhow!("pobrany plik przekracza limit 8 MB"));
    }
    std::fs::write(&tmp, &bytes).with_context(|| format!("write {}", tmp.display()))?;
    let result = import_and_persist_profile(state, &tmp);
    let _ = std::fs::remove_file(&tmp);
    result
}

fn parse_import_url_from_arg(arg: &str) -> Option<String> {
    if let Some(rest) = arg.strip_prefix("--import-voice-pack-url=") {
        let url = rest.trim();
        if !url.is_empty() {
            return Some(url.to_string());
        }
    }
    if arg.starts_with("ttshub://") {
        if let Some(idx) = arg.find("url=") {
            let url = arg[idx + 4..].trim();
            if !url.is_empty() {
                return Some(url.to_string());
            }
        }
    }
    None
}

/// CLI / OS launcher: `--import-voice-pack-url=https://…` or `ttshub://import-voice-pack?url=…`
pub fn startup_import_url_from_args() -> Option<String> {
    std::env::args().skip(1).find_map(|a| parse_import_url_from_arg(&a))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePackRequires {
    #[serde(default)]
    pub providers: Vec<String>,
    #[serde(default)]
    pub min_app_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePackProfilePayload {
    pub provider: String,
    pub model: String,
    pub voice: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub personality_enabled: Option<bool>,
    #[serde(default)]
    pub minimax_speed: Option<f32>,
    #[serde(default)]
    pub minimax_vol: Option<f32>,
    #[serde(default)]
    pub minimax_pitch: Option<i32>,
    #[serde(default)]
    pub minimax_options: Option<crate::minimax::MinimaxSynthesisOptions>,
    #[serde(default)]
    pub multi_speaker: bool,
    #[serde(default)]
    pub speakers: Vec<crate::voice_profiles::VoiceProfileSpeaker>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePackManifest {
    pub format: String,
    pub format_version: u32,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub preview_text: Option<String>,
    #[serde(default)]
    pub requires: Option<VoicePackRequires>,
    #[serde(default)]
    pub recommended_filter_preset_id: Option<String>,
    pub profile: VoicePackProfilePayload,
}

impl VoicePackProfilePayload {
    pub fn from_profile(profile: &TtsVoiceProfile) -> Self {
        Self {
            provider: profile.provider.clone(),
            model: profile.model.clone(),
            voice: profile.voice.clone(),
            style: profile.style.clone(),
            profile_id: profile.profile_id.clone(),
            language: profile.language.clone(),
            engine: profile.engine.clone(),
            personality_enabled: profile.personality_enabled,
            minimax_speed: profile.minimax_speed,
            minimax_vol: profile.minimax_vol,
            minimax_pitch: profile.minimax_pitch,
            minimax_options: profile.minimax_options.clone(),
            multi_speaker: profile.multi_speaker,
            speakers: profile.speakers.clone(),
        }
    }
}

pub fn slugify_pack_id(name: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for c in name.trim().chars() {
        let ch = if c.is_ascii_alphanumeric() {
            c.to_ascii_lowercase()
        } else if c == ' ' || c == '-' || c == '_' {
            '-'
        } else {
            continue;
        };
        if ch == '-' {
            if prev_dash || out.is_empty() {
                continue;
            }
            prev_dash = true;
        } else {
            prev_dash = false;
        }
        out.push(ch);
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "voice-pack".to_string()
    } else {
        trimmed
    }
}

pub fn profile_to_manifest(profile: &TtsVoiceProfile) -> VoicePackManifest {
    VoicePackManifest {
        format: FORMAT.to_string(),
        format_version: FORMAT_VERSION,
        id: slugify_pack_id(&profile.name),
        name: profile.name.clone(),
        description: profile.style.clone(),
        author: Some("TTS Hub".to_string()),
        license: Some("CC-BY-4.0".to_string()),
        tags: Vec::new(),
        preview_text: Some(SAMPLE_TEXT.to_string()),
        requires: Some(VoicePackRequires {
            providers: vec![profile.provider.clone()],
            min_app_version: Some(env!("CARGO_PKG_VERSION").to_string()),
        }),
        recommended_filter_preset_id: None,
        profile: VoicePackProfilePayload::from_profile(profile),
    }
}

pub fn manifest_to_profile(manifest: &VoicePackManifest) -> TtsVoiceProfile {
    let p = &manifest.profile;
    let mut profile = TtsVoiceProfile {
        id: Uuid::new_v4().to_string(),
        name: manifest.name.trim().to_string(),
        provider: p.provider.clone(),
        model: p.model.clone(),
        voice: p.voice.clone(),
        style: p.style.clone(),
        profile_id: p.profile_id.clone(),
        language: p.language.clone(),
        engine: p.engine.clone(),
        personality_enabled: p.personality_enabled,
        minimax_speed: p.minimax_speed,
        minimax_vol: p.minimax_vol,
        minimax_pitch: p.minimax_pitch,
        minimax_options: p.minimax_options.clone(),
        multi_speaker: p.multi_speaker,
        speakers: p.speakers.clone(),
        last_preview: None,
        last_preview_at: None,
        shortcut: None,
        shortcut_enabled: false,
    };
    profile.normalize();
    profile
}

pub fn export_voice_pack(
    paths: &AppPaths,
    profile: &TtsVoiceProfile,
    dest_path: &Path,
) -> Result<()> {
    let manifest = profile_to_manifest(profile);
    let file = File::create(dest_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let manifest_json = serde_json::to_vec_pretty(&manifest).context("serialize manifest")?;
    zip.start_file(MANIFEST_NAME, options)?;
    zip.write_all(&manifest_json)?;

    if let Some(preview) = resolve_preview_path(paths, profile) {
        let name = preview
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .filter(|e| *e == "mp3")
            .map(|_| PREVIEW_MP3)
            .unwrap_or(PREVIEW_WAV);
        zip.start_file(name, options)?;
        let bytes = std::fs::read(&preview)?;
        zip.write_all(&bytes)?;
    }

    let avatar_path = voice_avatar_path(paths, &profile.provider, &effective_voice_id(profile));
    if avatar_info(&avatar_path).exists {
        zip.start_file(AVATAR_PNG, options)?;
        let bytes = std::fs::read(&avatar_path)?;
        zip.write_all(&bytes)?;
    }

    zip.finish()?;
    Ok(())
}

fn effective_voice_id(profile: &TtsVoiceProfile) -> String {
    if profile.provider == crate::app_settings::PROVIDER_VOICEBOX {
        profile
            .profile_id
            .clone()
            .unwrap_or_else(|| profile.voice.clone())
    } else {
        profile.voice.clone()
    }
}

fn resolve_preview_path(paths: &AppPaths, profile: &TtsVoiceProfile) -> Option<PathBuf> {
    if profile.provider == crate::app_settings::PROVIDER_GOOGLE {
        let path = sample_path(paths, &profile.model, &profile.voice);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

pub fn import_voice_pack(archive_path: &Path) -> Result<(VoicePackManifest, TtsVoiceProfile)> {
    let meta = std::fs::metadata(archive_path)?;
    if meta.len() > MAX_ARCHIVE_BYTES {
        return Err(anyhow!("archiwum przekracza limit 8 MB"));
    }

    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file).context("nieprawidłowe archiwum ZIP")?;

    let mut manifest: Option<VoicePackManifest> = None;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let raw_name = entry.name().to_string();
        let name = raw_name.replace('\\', "/");
        if name.contains("..") || name.starts_with('/') {
            return Err(anyhow!("niedozwolona ścieżka w archiwum: {name}"));
        }
        if entry.is_dir() {
            continue;
        }
        if !is_allowed_archive_file(&name) {
            return Err(anyhow!("niedozwolony plik w archiwum: {name}"));
        }
        if name == MANIFEST_NAME || name.ends_with(&format!("/{MANIFEST_NAME}")) {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            let m: VoicePackManifest =
                serde_json::from_slice(&buf).context("parse manifest.json z archiwum")?;
            validate_manifest(&m)?;
            manifest = Some(m);
        }
    }

    let manifest = manifest.ok_or_else(|| anyhow!("archiwum musi zawierać manifest.json"))?;
    let profile = manifest_to_profile(&manifest);
    Ok((manifest, profile))
}

fn validate_manifest(m: &VoicePackManifest) -> Result<()> {
    if m.format.trim() != FORMAT {
        return Err(anyhow!(
            "nieobsługiwany format: {} (oczekiwano {FORMAT})",
            m.format
        ));
    }
    if m.format_version != FORMAT_VERSION {
        return Err(anyhow!(
            "nieobsługiwana wersja formatu: {} (oczekiwano {FORMAT_VERSION})",
            m.format_version
        ));
    }
    if m.id.trim().is_empty() || m.name.trim().is_empty() {
        return Err(anyhow!("manifest: wymagane pola id i name"));
    }
    if m.profile.provider.trim().is_empty()
        || m.profile.model.trim().is_empty()
        || m.profile.voice.trim().is_empty()
    {
        return Err(anyhow!("manifest.profile: wymagane provider, model, voice"));
    }
    Ok(())
}

fn is_allowed_archive_file(name: &str) -> bool {
    let base = name.rsplit('/').next().unwrap_or(name);
    if base == MANIFEST_NAME {
        return true;
    }
    let ext = base.rsplit('.').next().unwrap_or("").to_lowercase();
    ALLOWED_EXTENSIONS.contains(&ext.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_settings::PROVIDER_GOOGLE;
    use std::io::Cursor;

    fn sample_profile() -> TtsVoiceProfile {
        TtsVoiceProfile {
            id: "test-id".to_string(),
            name: "Narrator ciepły PL".to_string(),
            provider: PROVIDER_GOOGLE.to_string(),
            model: "gemini-2.5-flash-preview-tts".to_string(),
            voice: "Kore".to_string(),
            style: Some("Mów ciepło po polsku.".to_string()),
            profile_id: None,
            language: None,
            engine: None,
            personality_enabled: None,
            minimax_speed: None,
            minimax_vol: None,
            minimax_pitch: None,
            minimax_options: None,
            multi_speaker: false,
            speakers: vec![],
            last_preview: Some("should not export".to_string()),
            last_preview_at: Some(123),
            shortcut: Some("F9".to_string()),
            shortcut_enabled: true,
        }
    }

    #[test]
    fn slugify_pack_id_normalizes_name() {
        assert_eq!(slugify_pack_id("Narrator ciepły PL"), "narrator-ciepy-pl");
        assert_eq!(slugify_pack_id("  "), "voice-pack");
    }

    #[test]
    fn manifest_roundtrip_strips_local_fields() {
        let manifest = profile_to_manifest(&sample_profile());
        let profile = manifest_to_profile(&manifest);
        assert_eq!(profile.name, "Narrator ciepły PL");
        assert_eq!(profile.voice, "Kore");
        assert_eq!(profile.style.as_deref(), Some("Mów ciepło po polsku."));
        assert!(profile.shortcut.is_none());
        assert!(!profile.shortcut_enabled);
        assert!(profile.last_preview.is_none());
        assert_ne!(profile.id, "test-id");
    }

    #[test]
    fn import_rejects_wrong_format() {
        let manifest = VoicePackManifest {
            format: "other".to_string(),
            format_version: 1,
            id: "x".to_string(),
            name: "X".to_string(),
            description: None,
            author: None,
            license: None,
            tags: vec![],
            preview_text: None,
            requires: None,
            recommended_filter_preset_id: None,
            profile: VoicePackProfilePayload::from_profile(&sample_profile()),
        };
        assert!(validate_manifest(&manifest).is_err());
    }

    #[test]
    fn zip_import_reads_manifest() {
        let manifest = profile_to_manifest(&sample_profile());
        let mut buf = Vec::new();
        {
            let cursor = Cursor::new(&mut buf);
            let mut zip = ZipWriter::new(cursor);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            let json = serde_json::to_vec(&manifest).unwrap();
            zip.start_file(MANIFEST_NAME, options).unwrap();
            zip.write_all(&json).unwrap();
            zip.finish().unwrap();
        }
        let dir = std::env::temp_dir().join(format!("tts-voice-pack-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.ttshub-voice");
        std::fs::write(&path, &buf).unwrap();
        let (parsed, profile) = import_voice_pack(&path).unwrap();
        assert_eq!(parsed.id, "narrator-ciepy-pl");
        assert_eq!(profile.voice, "Kore");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn embedded_catalog_loads() {
        let catalog = embedded_catalog().expect("embedded catalog");
        assert_eq!(catalog.format, "ttshub-voice-catalog");
        assert!(catalog.packs.len() >= 5);
    }

    #[test]
    fn parse_import_url_from_arg_handles_cli_and_scheme() {
        assert_eq!(
            parse_import_url_from_arg("--import-voice-pack-url=https://x/y.ttshub-voice").as_deref(),
            Some("https://x/y.ttshub-voice")
        );
        assert_eq!(
            parse_import_url_from_arg("ttshub://import-voice-pack?url=https://x/y.ttshub-voice")
                .as_deref(),
            Some("https://x/y.ttshub-voice")
        );
        assert!(parse_import_url_from_arg("--other").is_none());
    }

    #[test]
    fn import_built_dist_pack_if_present() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../docs/voice-packs/dist/google-kore-cieply-pl.ttshub-voice");
        if !path.is_file() {
            return;
        }
        let (manifest, profile) = import_voice_pack(&path).expect("dist pack import");
        assert_eq!(manifest.id, "google-kore-cieply-pl");
        assert_eq!(profile.voice, "Kore");
    }
}
