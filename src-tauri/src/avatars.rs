use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use base64::Engine;
use image::imageops::FilterType;
use image::GenericImageView;
use serde::Serialize;

use crate::paths::AppPaths;

pub const AVATAR_SIZE: u32 = 512;

const VALID_SOURCES: &[&str] = &["manual", "http", "cursor", "cursor-skill", "quick_hotkey"];
const VALID_PROVIDERS: &[&str] = &["google", "minimax", "voicebox"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvatarInfo {
    pub exists: bool,
    pub path: Option<String>,
}

pub fn sanitize_key(s: &str) -> String {
    let trimmed = s.trim();
    let mut out = String::new();
    for c in trimmed.chars() {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
            out.push(c);
        } else if c == ' ' {
            out.push('_');
        }
    }
    if out.is_empty() {
        "unknown".to_string()
    } else {
        out
    }
}

pub fn validate_source(source: &str) -> Result<()> {
    if VALID_SOURCES.contains(&source) {
        Ok(())
    } else {
        anyhow::bail!("unknown source: {source}")
    }
}

pub fn validate_provider(provider: &str) -> Result<()> {
    let p = provider.trim().to_lowercase();
    if VALID_PROVIDERS.contains(&p.as_str()) {
        Ok(())
    } else {
        anyhow::bail!("unknown provider: {provider}")
    }
}

pub fn source_avatar_path(paths: &AppPaths, source: &str) -> PathBuf {
    paths
        .avatars
        .join("sources")
        .join(format!("{}.jpg", sanitize_key(source)))
}

pub fn voice_avatar_path(paths: &AppPaths, provider: &str, voice_id: &str) -> PathBuf {
    let provider = provider.trim().to_lowercase();
    paths
        .avatars
        .join("voices")
        .join(&provider)
        .join(format!("{}.jpg", sanitize_key(voice_id)))
}

pub fn avatar_info(path: &Path) -> AvatarInfo {
    if path.is_file() {
        AvatarInfo {
            exists: true,
            path: Some(path.to_string_lossy().into_owned()),
        }
    } else {
        AvatarInfo {
            exists: false,
            path: None,
        }
    }
}

pub fn list_source_avatars(paths: &AppPaths) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for source in VALID_SOURCES {
        let path = source_avatar_path(paths, source);
        if path.is_file() {
            map.insert((*source).to_string(), path.to_string_lossy().into_owned());
        }
    }
    map
}

pub fn save_avatar_jpeg(path: &Path, image_base64: &str) -> Result<()> {
    let raw = strip_data_url(image_base64);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw.trim())
        .context("invalid base64 image data")?;

    let img = image::load_from_memory(&bytes).context("decode image")?;
    let resized = resize_square_jpeg(&img)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, resized).context("write avatar jpg")?;
    Ok(())
}

pub fn delete_avatar_file(path: &Path) -> Result<()> {
    if path.is_file() {
        std::fs::remove_file(path).context("remove avatar")?;
    }
    Ok(())
}

fn strip_data_url(input: &str) -> &str {
    let s = input.trim();
    if let Some(idx) = s.find("base64,") {
        return &s[idx + "base64,".len()..];
    }
    s
}

fn resize_square_jpeg(img: &image::DynamicImage) -> Result<Vec<u8>> {
    let (w, h) = img.dimensions();
    let side = w.min(h);
    let left = (w - side) / 2;
    let top = (h - side) / 2;
    let cropped = img.crop_imm(left, top, side, side);
    let resized = if side == AVATAR_SIZE {
        cropped
    } else {
        cropped.resize_exact(AVATAR_SIZE, AVATAR_SIZE, FilterType::Lanczos3)
    };
    let mut out = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut out);
    resized
        .write_to(&mut cursor, image::ImageFormat::Jpeg)
        .context("encode jpeg")?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_key_replaces_spaces() {
        assert_eq!(sanitize_key("my voice"), "my_voice");
    }
}
