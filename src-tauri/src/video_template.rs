use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const BUILTIN_WHATSAPP_ID: &str = "builtin-whatsapp-karaoke";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VideoRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum VideoLayer {
    #[serde(rename = "cover")]
    Cover {
        id: String,
        visible: bool,
        rect: VideoRect,
        mode: String,
        #[serde(rename = "objectFit", default = "default_object_fit")]
        object_fit: String,
    },
    #[serde(rename = "karaoke")]
    Karaoke {
        id: String,
        visible: bool,
        rect: VideoRect,
        source: String,
        font_name: String,
        font_size: u32,
        primary_color: String,
        highlight_color: String,
        outline: u32,
        alignment: u32,
    },
    #[serde(rename = "footer")]
    Footer {
        id: String,
        visible: bool,
        rect: VideoRect,
        template: String,
        font_size: u32,
        color: String,
        align: String,
    },
    #[serde(rename = "watermark")]
    Watermark {
        id: String,
        visible: bool,
        rect: VideoRect,
        text: String,
        logo_path: Option<String>,
        opacity: f32,
    },
    #[serde(rename = "image")]
    Image {
        id: String,
        visible: bool,
        rect: VideoRect,
        image_path: Option<String>,
        #[serde(rename = "objectFit", default = "default_object_fit")]
        object_fit: String,
        opacity: f32,
    },
    #[serde(rename = "shape")]
    Shape {
        id: String,
        visible: bool,
        rect: VideoRect,
        #[serde(rename = "shapeKind", default = "default_shape_kind")]
        shape_kind: String,
        fill: String,
        stroke: String,
        #[serde(rename = "strokeWidth", default = "default_stroke_width")]
        stroke_width: u32,
        opacity: f32,
    },
}

fn default_object_fit() -> String {
    "contain".to_string()
}

fn default_shape_kind() -> String {
    "rect".to_string()
}

fn default_stroke_width() -> u32 {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoCanvas {
    pub width: u32,
    pub height: u32,
    pub background: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputSettings {
    pub video_codec: String,
    pub audio_codec: String,
    pub audio_bitrate_k: u32,
    pub tune: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTemplate {
    pub id: String,
    pub name: String,
    pub version: u32,
    pub canvas: VideoCanvas,
    pub layers: Vec<VideoLayer>,
    pub output: VideoOutputSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTemplateMeta {
    pub id: String,
    pub name: String,
    pub updated_at: i64,
    pub is_builtin: bool,
}

impl VideoTemplate {
    pub fn builtin_whatsapp() -> Self {
        Self {
            id: BUILTIN_WHATSAPP_ID.to_string(),
            name: "WhatsApp Karaoke".to_string(),
            version: 1,
            canvas: VideoCanvas {
                width: 720,
                height: 720,
                background: "#12141a".to_string(),
            },
            layers: vec![
                VideoLayer::Cover {
                    id: "cover".to_string(),
                    visible: true,
                    rect: VideoRect {
                        x: 170,
                        y: 40,
                        width: 380,
                        height: 380,
                    },
                    mode: "profile".to_string(),
                    object_fit: "contain".to_string(),
                },
                VideoLayer::Karaoke {
                    id: "karaoke".to_string(),
                    visible: true,
                    rect: VideoRect {
                        x: 40,
                        y: 480,
                        width: 640,
                        height: 120,
                    },
                    source: "minimax_json".to_string(),
                    font_name: "Arial".to_string(),
                    font_size: 40,
                    primary_color: "#A8B0C0".to_string(),
                    highlight_color: "#FFD700".to_string(),
                    outline: 3,
                    alignment: 2,
                },
                VideoLayer::Footer {
                    id: "footer".to_string(),
                    visible: true,
                    rect: VideoRect {
                        x: 0,
                        y: 684,
                        width: 720,
                        height: 36,
                    },
                    template: "{{voice}} · {{model}} · {{duration}} · TTS Hub".to_string(),
                    font_size: 18,
                    color: "#A8B0C0".to_string(),
                    align: "center".to_string(),
                },
                VideoLayer::Watermark {
                    id: "watermark".to_string(),
                    visible: true,
                    rect: VideoRect {
                        x: 620,
                        y: 24,
                        width: 80,
                        height: 56,
                    },
                    text: "TTS Hub".to_string(),
                    logo_path: None,
                    opacity: 0.38,
                },
            ],
            output: VideoOutputSettings {
                video_codec: "libx264".to_string(),
                audio_codec: "aac".to_string(),
                audio_bitrate_k: 128,
                tune: "stillimage".to_string(),
            },
        }
    }

    pub fn validate(&self) -> Result<()> {
        if self.canvas.width < 480 || self.canvas.height < 480 {
            anyhow::bail!("canvas min 480×480");
        }
        if self.canvas.width > 1920 || self.canvas.height > 1920 {
            anyhow::bail!("canvas max 1920×1920");
        }
        if self.layers.is_empty() {
            anyhow::bail!("template needs at least one layer");
        }
        Ok(())
    }

    pub fn cover_layer(&self) -> Option<&VideoLayer> {
        self.layers.iter().find(|l| matches!(l, VideoLayer::Cover { .. }))
    }

    pub fn karaoke_layer(&self) -> Option<&VideoLayer> {
        self.layers.iter().find(|l| matches!(l, VideoLayer::Karaoke { visible: true, .. }))
    }

    pub fn footer_layer(&self) -> Option<&VideoLayer> {
        self.layers.iter().find(|l| matches!(l, VideoLayer::Footer { visible: true, .. }))
    }

    pub fn watermark_layer(&self) -> Option<&VideoLayer> {
        self.layers.iter().find(|l| matches!(l, VideoLayer::Watermark { visible: true, .. }))
    }
}

pub fn templates_dir(root: &Path) -> PathBuf {
    root.join("video_templates")
}

pub fn ensure_templates_dir(root: &Path) -> Result<PathBuf> {
    let dir = templates_dir(root);
    std::fs::create_dir_all(&dir).context("create video_templates dir")?;
    Ok(dir)
}

pub fn template_file_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.json"))
}

pub fn ensure_builtin_template(root: &Path) -> Result<()> {
    let dir = ensure_templates_dir(root)?;
    let path = template_file_path(&dir, BUILTIN_WHATSAPP_ID);
    if !path.is_file() {
        let tpl = VideoTemplate::builtin_whatsapp();
        save_template_file(&path, &tpl)?;
    }
    Ok(())
}

pub fn save_template_file(path: &Path, template: &VideoTemplate) -> Result<()> {
    template.validate()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(template).context("serialize template")?;
    std::fs::write(path, json).context("write template file")?;
    Ok(())
}

pub fn load_template_file(path: &Path) -> Result<VideoTemplate> {
    let raw = std::fs::read_to_string(path).context("read template file")?;
    let tpl: VideoTemplate = serde_json::from_str(&raw).context("parse template json")?;
    tpl.validate()?;
    Ok(tpl)
}

pub fn load_template_by_id(root: &Path, id: &str) -> Result<VideoTemplate> {
    if id == BUILTIN_WHATSAPP_ID {
        let path = template_file_path(&templates_dir(root), id);
        if path.is_file() {
            return load_template_file(&path);
        }
        return Ok(VideoTemplate::builtin_whatsapp());
    }
    let path = template_file_path(&templates_dir(root), id);
    if !path.is_file() {
        anyhow::bail!("template not found: {id}");
    }
    load_template_file(&path)
}

pub fn list_template_metas(root: &Path) -> Result<Vec<VideoTemplateMeta>> {
    ensure_builtin_template(root)?;
    let dir = templates_dir(root);
    let mut metas = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(tpl) = load_template_file(&path) {
                let is_builtin = tpl.id == BUILTIN_WHATSAPP_ID;
                let updated_at = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                metas.push(VideoTemplateMeta {
                    id: tpl.id,
                    name: tpl.name,
                    updated_at,
                    is_builtin,
                });
            }
        }
    }

    if !metas.iter().any(|m| m.id == BUILTIN_WHATSAPP_ID) {
        let tpl = VideoTemplate::builtin_whatsapp();
        metas.insert(
            0,
            VideoTemplateMeta {
                id: tpl.id,
                name: tpl.name,
                updated_at: 0,
                is_builtin: true,
            },
        );
    }

    metas.sort_by(|a, b| {
        b.is_builtin
            .cmp(&a.is_builtin)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(metas)
}

pub fn delete_user_template(root: &Path, id: &str) -> Result<()> {
    if id == BUILTIN_WHATSAPP_ID {
        anyhow::bail!("cannot delete built-in template");
    }
    let path = template_file_path(&templates_dir(root), id);
    if path.is_file() {
        std::fs::remove_file(path).context("delete template file")?;
    }
    Ok(())
}

pub fn duplicate_template(root: &Path, source_id: &str, new_name: &str) -> Result<VideoTemplate> {
    let mut tpl = load_template_by_id(root, source_id)?;
    tpl.id = Uuid::new_v4().to_string();
    tpl.name = new_name.trim().to_string();
    if tpl.name.is_empty() {
        tpl.name = format!("Kopia {}", source_id);
    }
    let dir = ensure_templates_dir(root)?;
    save_template_file(&template_file_path(&dir, &tpl.id), &tpl)?;
    Ok(tpl)
}

pub fn default_template_id(settings: &crate::app_settings::AppSettings) -> String {
    settings
        .default_video_template_id
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(BUILTIN_WHATSAPP_ID)
        .to_string()
}

pub fn preset_portrait_916() -> VideoTemplate {
    let mut tpl = VideoTemplate::builtin_whatsapp();
    tpl.id = String::new();
    tpl.name = "Pion 9:16".to_string();
    tpl.canvas.width = 720;
    tpl.canvas.height = 1280;
    tpl.layers = vec![
        VideoLayer::Cover {
            id: "cover".to_string(),
            visible: true,
            rect: VideoRect {
                x: 110,
                y: 80,
                width: 500,
                height: 500,
            },
            mode: "profile".to_string(),
            object_fit: "contain".to_string(),
        },
        VideoLayer::Karaoke {
            id: "karaoke".to_string(),
            visible: true,
            rect: VideoRect {
                x: 40,
                y: 900,
                width: 640,
                height: 160,
            },
            source: "minimax_json".to_string(),
            font_name: "Arial".to_string(),
            font_size: 42,
            primary_color: "#A8B0C0".to_string(),
            highlight_color: "#FFD700".to_string(),
            outline: 3,
            alignment: 2,
        },
        VideoLayer::Footer {
            id: "footer".to_string(),
            visible: true,
            rect: VideoRect {
                x: 0,
                y: 1220,
                width: 720,
                height: 40,
            },
            template: "{{voice}} · {{model}} · {{duration}} · TTS Hub".to_string(),
            font_size: 20,
            color: "#A8B0C0".to_string(),
            align: "center".to_string(),
        },
        VideoLayer::Watermark {
            id: "watermark".to_string(),
            visible: true,
            rect: VideoRect {
                x: 620,
                y: 32,
                width: 80,
                height: 56,
            },
            text: "TTS Hub".to_string(),
            logo_path: None,
            opacity: 0.38,
        },
    ];
    tpl
}

pub fn preset_landscape_169() -> VideoTemplate {
    let mut tpl = VideoTemplate::builtin_whatsapp();
    tpl.id = String::new();
    tpl.name = "Poziom 16:9".to_string();
    tpl.canvas.width = 1280;
    tpl.canvas.height = 720;
    tpl.layers = vec![
        VideoLayer::Cover {
            id: "cover".to_string(),
            visible: true,
            rect: VideoRect {
                x: 80,
                y: 60,
                width: 420,
                height: 420,
            },
            mode: "profile".to_string(),
            object_fit: "contain".to_string(),
        },
        VideoLayer::Karaoke {
            id: "karaoke".to_string(),
            visible: true,
            rect: VideoRect {
                x: 540,
                y: 200,
                width: 700,
                height: 200,
            },
            source: "minimax_json".to_string(),
            font_name: "Arial".to_string(),
            font_size: 38,
            primary_color: "#A8B0C0".to_string(),
            highlight_color: "#FFD700".to_string(),
            outline: 3,
            alignment: 2,
        },
        VideoLayer::Footer {
            id: "footer".to_string(),
            visible: true,
            rect: VideoRect {
                x: 0,
                y: 680,
                width: 1280,
                height: 36,
            },
            template: "{{voice}} · {{model}} · {{duration}} · TTS Hub".to_string(),
            font_size: 18,
            color: "#A8B0C0".to_string(),
            align: "center".to_string(),
        },
        VideoLayer::Watermark {
            id: "watermark".to_string(),
            visible: true,
            rect: VideoRect {
                x: 1180,
                y: 24,
                width: 80,
                height: 56,
            },
            text: "TTS Hub".to_string(),
            logo_path: None,
            opacity: 0.38,
        },
    ];
    tpl
}
