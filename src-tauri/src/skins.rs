use std::fs::File;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

const MAX_ARCHIVE_BYTES: u64 = 2 * 1024 * 1024;
const ALLOWED_EXTENSIONS: &[&str] = &["json", "css", "png", "svg", "md", "txt"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinListEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dir_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub extends: Option<String>,
    #[serde(default)]
    pub tokens: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(default)]
    pub css: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CustomSkinLoaded {
    pub manifest: SkinManifest,
    pub dir_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css_text: Option<String>,
}

pub fn list_custom_skins(skins_dir: &Path) -> Result<Vec<SkinListEntry>> {
    let mut out = Vec::new();
    if !skins_dir.is_dir() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(skins_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let dir = entry.path();
        let manifest_path = dir.join("skin.json");
        if !manifest_path.is_file() {
            continue;
        }
        let manifest = read_manifest_file(&manifest_path)?;
        out.push(SkinListEntry {
            id: manifest.id.clone(),
            name: manifest.name,
            version: manifest.version,
            author: manifest.author,
            source: "custom".to_string(),
            dir_path: Some(dir.to_string_lossy().to_string()),
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

pub fn read_custom_skin(skins_dir: &Path, skin_id: &str) -> Result<CustomSkinLoaded> {
    let dir = skins_dir.join(skin_id);
    if !dir.is_dir() {
        return Err(anyhow!("skórka nie istnieje: {skin_id}"));
    }
    let manifest_path = dir.join("skin.json");
    let manifest = read_manifest_file(&manifest_path)?;
    if manifest.id != skin_id {
        return Err(anyhow!(
            "id w skin.json ({}) nie zgadza się z folderem ({skin_id})",
            manifest.id
        ));
    }
    let css_text = load_optional_css(&dir, manifest.css.as_deref())?;
    Ok(CustomSkinLoaded {
        manifest,
        dir_path: dir.to_string_lossy().to_string(),
        css_text,
    })
}

fn load_optional_css(dir: &Path, css_rel: Option<&str>) -> Result<Option<String>> {
    let Some(rel) = css_rel else {
        return Ok(None);
    };
    let path = dir.join(rel);
    if !path.is_file() {
        return Ok(None);
    }
    validate_safe_relative(rel)?;
    let text =
        std::fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
    Ok(Some(text))
}

pub fn install_skin_archive(
    skins_dir: &Path,
    archive_path: &Path,
    overwrite: bool,
) -> Result<String> {
    let meta = std::fs::metadata(archive_path)?;
    if meta.len() > MAX_ARCHIVE_BYTES {
        return Err(anyhow!("archiwum przekracza limit 2 MB"));
    }

    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file).context("nieprawidłowe archiwum ZIP")?;

    let mut manifest: Option<SkinManifest> = None;
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

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
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)?;
        if name == "skin.json" || name.ends_with("/skin.json") {
            let m: SkinManifest =
                serde_json::from_slice(&buf).context("parse skin.json z archiwum")?;
            validate_manifest(&m)?;
            manifest = Some(m);
        }
        files.push((name, buf));
    }

    let manifest = manifest.ok_or_else(|| anyhow!("archiwum musi zawierać skin.json"))?;
    let dest = skins_dir.join(&manifest.id);
    if dest.exists() && !overwrite {
        return Err(anyhow!(
            "skórka „{}” już istnieje — użyj nadpisania",
            manifest.id
        ));
    }
    if dest.exists() {
        std::fs::remove_dir_all(&dest)?;
    }
    std::fs::create_dir_all(&dest)?;

    for (name, buf) in files {
        let rel = name
            .strip_prefix(&format!("{}/", manifest.id))
            .unwrap_or(name.as_str());
        let rel = rel.strip_prefix('/').unwrap_or(rel);
        validate_safe_relative(rel)?;
        let out_path = dest.join(rel);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&out_path, buf)?;
    }

    Ok(manifest.id)
}

pub fn export_skin(skins_dir: &Path, skin_id: &str, dest_path: &Path) -> Result<()> {
    let dir = skins_dir.join(skin_id);
    if !dir.is_dir() {
        return Err(anyhow!("skórka nie istnieje: {skin_id}"));
    }
    let file = File::create(dest_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for entry in walkdir_files(&dir)? {
        let rel = entry
            .strip_prefix(&dir)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        zip.start_file(rel, options)?;
        let mut f = File::open(&entry)?;
        let mut buf = Vec::new();
        f.read_to_end(&mut buf)?;
        zip.write_all(&buf)?;
    }
    zip.finish()?;
    Ok(())
}

fn walkdir_files(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            files.extend(walkdir_files(&path)?);
        } else if path.is_file() {
            files.push(path);
        }
    }
    Ok(files)
}

fn read_manifest_file(path: &Path) -> Result<SkinManifest> {
    let raw = std::fs::read_to_string(path)?;
    let manifest: SkinManifest = serde_json::from_str(&raw).context("parse skin.json")?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn validate_manifest(m: &SkinManifest) -> Result<()> {
    if m.id.trim().is_empty()
        || m.name.trim().is_empty()
        || m.version.trim().is_empty()
        || m.author.trim().is_empty()
    {
        return Err(anyhow!(
            "skin.json: wymagane pola id, name, version, author"
        ));
    }
    if !m
        .id
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
        || !m.id.starts_with(|c: char| c.is_ascii_lowercase())
    {
        return Err(anyhow!("skin.json: nieprawidłowe id"));
    }
    Ok(())
}

fn validate_safe_relative(rel: &str) -> Result<()> {
    let path = Path::new(rel);
    for comp in path.components() {
        match comp {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(anyhow!("niedozwolona ścieżka: {rel}"));
            }
            _ => {}
        }
    }
    Ok(())
}

fn is_allowed_archive_file(name: &str) -> bool {
    let base = name.rsplit('/').next().unwrap_or(name);
    if base == "skin.json" {
        return true;
    }
    let ext = base.rsplit('.').next().unwrap_or("").to_lowercase();
    ALLOWED_EXTENSIONS.contains(&ext.as_str())
}
