use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

use crate::audio::ensure_ffmpeg;
use crate::minimax_subtitles::{
    estimate_word_timings_from_text, expand_sentences_to_words, parse_minimax_subtitles_with_duration,
    write_karaoke_ass_with_layout, KaraokeAssLayout, KaraokeScrollMode, TimedWord,
};
use crate::video_template::{VideoLayer, VideoRect, VideoTemplate};

/// Square 720×720 — good WhatsApp chat preview; small file size.
pub const WHATSAPP_VIDEO_SIZE: u32 = 720;

const COVER_MAX_KARAOKE: u32 = 380;
const COVER_MAX_STATIC: u32 = 480;
const FOOTER_PAD: u32 = 18;
const BG_COLOR: &str = "0x12141a";
/// Constant frame rate for still+karaoke. `r=1` made `-shortest` overshoot (often ~1 min of silence).
const VIDEO_FPS: u32 = 25;
const VIDEO_FPS_ARG: &str = "25";

/// Kind of additional ffmpeg input that a decorative layer needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtraInputKind {
    /// Still image repeated at `VIDEO_FPS` (existing behaviour).
    Image,
    /// Animated video (MP4 / WebM / MOV). Looped indefinitely via
    /// `-stream_loop -1`; truncated by `-shortest` to match audio.
    Video,
}

/// Describes one extra ffmpeg input attached to the export command.
/// Ordered: `extra_inputs[i]` becomes input index `2 + i` in the
/// resulting ffmpeg invocation (`-loop … -i <path>` or
/// `-stream_loop -1 -i <path>`).
#[derive(Debug, Clone)]
pub struct ExtraInput {
    pub path: PathBuf,
    pub kind: ExtraInputKind,
}

#[derive(Debug, Clone)]
pub enum DecorativeLayerSpec {
    Image {
        path: PathBuf,
        rect: VideoRect,
        object_fit: String,
        opacity: f32,
    },
    Shape {
        rect: VideoRect,
        shape_kind: String,
        fill: String,
        stroke: String,
        stroke_width: u32,
        opacity: f32,
    },
    CustomText {
        rect: VideoRect,
        text: String,
        font_name: String,
        font_size: u32,
        color: String,
        background: bool,
        background_color: String,
        background_opacity: f32,
        align: String,
        vertical_align: String,
        bold: bool,
        italic: bool,
    },
    /// Animated short video loop (MP4/WebM) overlaid on top of the cover.
    /// `path` points to a user-picked file or to a bundled Tauri resource
    /// (e.g. `tshub_baner.mp4` from `public/`).
    /// `rotation_speed` is rotations per second; `0.0` = static.
    VideoLoop {
        path: PathBuf,
        rect: VideoRect,
        rotation_speed: f32,
        opacity: f32,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mp4ExportProgress {
    pub id: String,
    pub phase: String,
    pub percent: f32,
    pub message: String,
    /// Remaining time estimate in milliseconds (frontend ETA).
    /// `None` when not yet computable (e.g. before ffmpeg streams progress).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_ms: Option<u64>,
}

pub struct ShareVideoExportOptions {
    pub width: u32,
    pub height: u32,
    pub template_id: Option<String>,
    pub bg_color: String,
    pub bg_gradient_to: Option<String>,
    pub bg_gradient_kind: String,
    pub bg_gradient_angle: u32,
    pub cover_rect: Option<VideoRect>,
    pub cover_object_fit: String,
    pub decorative_layers: Vec<DecorativeLayerSpec>,
    pub karaoke_enabled: bool,
    pub karaoke_margin_v: Option<u32>,
    pub karaoke_font_size: Option<u32>,
    pub karaoke_rect: Option<VideoRect>,
    pub karaoke_scroll_mode: String,
    pub footer_rect: Option<VideoRect>,
    pub footer_font_size: u32,
    pub footer_align: String,
    pub watermark_rect: Option<VideoRect>,
    pub watermark_opacity: f32,
    /// Static fallback title when karaoke subtitles are unavailable.
    pub title_lines: Vec<String>,
    pub subtitle_json: Option<PathBuf>,
    /// Used when subtitle JSON is missing or unparsable (MiniMax fallback).
    pub fallback_karaoke_text: Option<String>,
    pub audio_path: PathBuf,
    pub footer_line: Option<String>,
    pub watermark_text: String,
    pub watermark_logo: Option<PathBuf>,
    pub export_id: Option<String>,
    pub progress: Option<Arc<dyn Fn(Mp4ExportProgress) + Send + Sync>>,
}

impl Default for ShareVideoExportOptions {
    fn default() -> Self {
        Self {
            width: WHATSAPP_VIDEO_SIZE,
            height: WHATSAPP_VIDEO_SIZE,
            template_id: None,
            bg_color: BG_COLOR.to_string(),
            bg_gradient_to: None,
            bg_gradient_kind: "solid".to_string(),
            bg_gradient_angle: 180,
            cover_rect: None,
            cover_object_fit: "contain".to_string(),
            decorative_layers: Vec::new(),
            karaoke_enabled: true,
            karaoke_margin_v: None,
            karaoke_font_size: None,
            karaoke_rect: None,
            karaoke_scroll_mode: "classic".to_string(),
            footer_rect: None,
            footer_font_size: 18,
            footer_align: "center".to_string(),
            watermark_rect: None,
            watermark_opacity: 0.38,
            title_lines: Vec::new(),
            subtitle_json: None,
            fallback_karaoke_text: None,
            audio_path: PathBuf::new(),
            footer_line: None,
            watermark_text: "TTS Hub".to_string(),
            watermark_logo: None,
            export_id: None,
            progress: None,
        }
    }
}

/// Back-compat alias.
#[allow(dead_code)]
pub type StillVideoExportOptions = ShareVideoExportOptions;

pub fn share_opts_from_template(
    template: &VideoTemplate,
) -> (
    u32,
    u32,
    String,
    Option<VideoRect>,
    bool,
    Option<u32>,
    Option<u32>,
    Option<VideoRect>,
    u32,
    String,
    Option<VideoRect>,
    f32,
) {
    let w = template.canvas.width;
    let h = template.canvas.height;
    let bg = hex_to_ffmpeg_color(&template.canvas.background);

    let mut cover_rect = None;
    let mut karaoke_enabled = false;
    let mut karaoke_margin_v = None;
    let mut karaoke_font_size = None;
    let mut footer_rect = None;
    let mut footer_font_size = 18u32;
    let mut footer_align = "center".to_string();
    let mut watermark_rect = None;
    let mut watermark_opacity = 0.38f32;

    for layer in &template.layers {
        match layer {
            VideoLayer::Cover {
                visible: true,
                rect,
                ..
            } => cover_rect = Some(*rect),
            VideoLayer::Karaoke {
                visible: true,
                rect,
                font_size,
                ..
            } => {
                karaoke_enabled = true;
                karaoke_margin_v = Some(h.saturating_sub(rect.y + rect.height / 2));
                karaoke_font_size = Some(*font_size);
            }
            VideoLayer::Footer {
                visible: true,
                rect,
                font_size,
                align,
                ..
            } => {
                footer_rect = Some(*rect);
                footer_font_size = *font_size;
                footer_align = align.clone();
            }
            VideoLayer::Watermark {
                visible: true,
                rect,
                opacity,
                ..
            } => {
                watermark_rect = Some(*rect);
                watermark_opacity = *opacity;
            }
            _ => {}
        }
    }

    (
        w,
        h,
        bg,
        cover_rect,
        karaoke_enabled,
        karaoke_margin_v,
        karaoke_font_size,
        footer_rect,
        footer_font_size,
        footer_align,
        watermark_rect,
        watermark_opacity,
    )
}

/// Optional callback used to resolve non-absolute `videoPath`s to a real
/// filesystem path. The caller (typically a Tauri command with access
/// to `AppHandle`) resolves bundled resources / dev-time paths. `None`
/// means "treat the path as-is".
///
/// Wrapped in `Arc` so it can be moved into `spawn_blocking` threads.
pub type VideoPathResolver = std::sync::Arc<dyn Fn(&str) -> Option<PathBuf> + Send + Sync>;

pub fn apply_template_to_opts(
    opts: &mut ShareVideoExportOptions,
    template: &VideoTemplate,
    resolve_video: Option<&VideoPathResolver>,
) {
    let (
        w,
        h,
        bg,
        cover_rect,
        karaoke_enabled,
        karaoke_margin_v,
        karaoke_font_size,
        footer_rect,
        footer_font_size,
        footer_align,
        watermark_rect,
        watermark_opacity,
    ) = share_opts_from_template(template);

    opts.width = w;
    opts.height = h;
    opts.template_id = Some(template.id.clone());
    opts.bg_color = bg;
    opts.bg_gradient_to = template
        .canvas
        .background_to
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(hex_to_ffmpeg_color);
    opts.bg_gradient_kind = template.canvas.background_mode.clone();
    opts.bg_gradient_angle = template.canvas.background_angle;
    opts.cover_rect = cover_rect;
    opts.karaoke_enabled = karaoke_enabled;
    opts.karaoke_margin_v = karaoke_margin_v;
    opts.karaoke_font_size = karaoke_font_size;
    opts.karaoke_rect = None;
    opts.karaoke_scroll_mode = "classic".to_string();
    opts.footer_rect = footer_rect;
    opts.footer_font_size = footer_font_size;
    opts.footer_align = footer_align;
    opts.watermark_rect = watermark_rect;
    opts.watermark_opacity = watermark_opacity;
    opts.cover_object_fit = "contain".to_string();
    opts.decorative_layers.clear();

    for layer in &template.layers {
        match layer {
            VideoLayer::Cover {
                visible: true,
                object_fit,
                ..
            } => {
                opts.cover_object_fit = object_fit.clone();
            }
            VideoLayer::Karaoke {
                visible: true,
                rect,
                scroll_mode,
                ..
            } => {
                opts.karaoke_rect = Some(*rect);
                opts.karaoke_scroll_mode = scroll_mode.clone();
            }
            VideoLayer::Image {
                visible: true,
                rect,
                image_path: Some(path),
                object_fit,
                opacity,
                ..
            } if !path.trim().is_empty() => {
                let p = PathBuf::from(path);
                if p.is_file() {
                    opts.decorative_layers.push(DecorativeLayerSpec::Image {
                        path: p,
                        rect: *rect,
                        object_fit: object_fit.clone(),
                        opacity: *opacity,
                    });
                }
            }
            VideoLayer::Shape {
                visible: true,
                rect,
                shape_kind,
                fill,
                stroke,
                stroke_width,
                opacity,
                ..
            } => {
                opts.decorative_layers.push(DecorativeLayerSpec::Shape {
                    rect: *rect,
                    shape_kind: shape_kind.clone(),
                    fill: fill.clone(),
                    stroke: stroke.clone(),
                    stroke_width: *stroke_width,
                    opacity: *opacity,
                });
            }
            VideoLayer::CustomText {
                visible: true,
                rect,
                text,
                font_name,
                font_size,
                color,
                background,
                background_color,
                background_opacity,
                align,
                vertical_align,
                bold,
                italic,
                ..
            } => {
                opts.decorative_layers.push(DecorativeLayerSpec::CustomText {
                    rect: *rect,
                    text: text.clone(),
                    font_name: font_name.clone(),
                    font_size: *font_size,
                    color: color.clone(),
                    background: *background,
                    background_color: background_color.clone(),
                    background_opacity: *background_opacity,
                    align: align.clone(),
                    vertical_align: vertical_align.clone(),
                    bold: *bold,
                    italic: *italic,
                });
            }
            VideoLayer::VideoLoop {
                visible: true,
                rect,
                video_path: Some(path),
                rotation_speed,
                opacity,
                ..
            } if !path.trim().is_empty() => {
                let p = PathBuf::from(path);
                let resolved = if p.is_file() {
                    Some(p)
                } else if let Some(resolver) = resolve_video {
                    resolver(path)
                } else {
                    None
                };
                if let Some(rp) = resolved {
                    if rp.is_file() {
                        opts.decorative_layers.push(DecorativeLayerSpec::VideoLoop {
                            path: rp,
                            rect: *rect,
                            rotation_speed: *rotation_speed,
                            opacity: *opacity,
                        });
                    }
                }
            }
            _ => {}
        }
    }

    if let Some(VideoLayer::Footer { template: footer_tpl, .. }) = template
        .layers
        .iter()
        .find(|l| matches!(l, VideoLayer::Footer { visible: true, .. }))
    {
        if opts.footer_line.is_none() {
            opts.footer_line = Some(footer_tpl.clone());
        }
    }
    if let Some(VideoLayer::Watermark { text, .. }) = template
        .layers
        .iter()
        .find(|l| matches!(l, VideoLayer::Watermark { visible: true, .. }))
    {
        if opts.watermark_text == "TTS Hub" && !text.trim().is_empty() {
            opts.watermark_text = text.clone();
        }
    }
}

fn parse_rgb(hex: &str) -> (u8, u8, u8) {
    let trimmed = hex
        .trim()
        .trim_start_matches('#')
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if trimmed.len() >= 6 {
        let r = u8::from_str_radix(&trimmed[0..2], 16).unwrap_or(0x12);
        let g = u8::from_str_radix(&trimmed[2..4], 16).unwrap_or(0x14);
        let b = u8::from_str_radix(&trimmed[4..6], 16).unwrap_or(0x1a);
        (r, g, b)
    } else {
        (0x12, 0x14, 0x1a)
    }
}

fn gradient_t_expr(kind: &str, w: u32, h: u32, angle: u32) -> String {
    if kind.eq_ignore_ascii_case("radial") {
        return "hypot(X-W/2\\,Y-H/2)/hypot(W/2\\,H/2)".to_string();
    }
    let a = (angle as f64).to_radians();
    let dx = a.sin();
    let dy = -a.cos();
    let wf = w as f64;
    let hf = h as f64;
    let corners = [(0.0, 0.0), (wf, 0.0), (0.0, hf), (wf, hf)];
    let mut pmin = f64::MAX;
    let mut pmax = f64::MIN;
    for (x, y) in corners {
        let p = x * dx + y * dy;
        pmin = pmin.min(p);
        pmax = pmax.max(p);
    }
    let span = (pmax - pmin).max(1.0);
    format!("(X*{dx:.6}+Y*{dy:.6}-{pmin:.4})/{span:.4}")
}

fn geq_channel(c0: u8, c1: u8, t: &str) -> String {
    if c0 == c1 {
        format!("{c0}")
    } else {
        format!("{c0}+({c1}-{c0})*({t})")
    }
}

fn uses_gradient_bg(kind: &str, color_to: Option<&str>) -> bool {
    color_to.is_some()
        && matches!(
            kind.trim().to_ascii_lowercase().as_str(),
            "linear" | "radial" | "gradient"
        )
}

/// Solid `color=` or RGB `geq` gradient, always labeled `[vbase]`.
fn background_source_filter(
    w: u32,
    h: u32,
    color: &str,
    color_to: Option<&str>,
    kind: &str,
    angle: u32,
    duration_secs: Option<&str>,
) -> String {
    let dur = duration_secs
        .map(|d| format!(":d={d}"))
        .unwrap_or_default();
    if let Some(to) = color_to.filter(|_| uses_gradient_bg(kind, color_to)) {
        let (r0, g0, b0) = parse_rgb(color);
        let (r1, g1, b1) = parse_rgb(to);
        let t = gradient_t_expr(kind, w, h, angle);
        let re = geq_channel(r0, r1, &t);
        let ge = geq_channel(g0, g1, &t);
        let be = geq_channel(b0, b1, &t);
        format!(
            "color=c=black:s={w}x{h}:r={VIDEO_FPS}{dur},format=gbrp,geq=r='{re}':g='{ge}':b='{be}',format=yuv420p[vbase]"
        )
    } else {
        format!("color=c={color}:s={w}x{h}:r={VIDEO_FPS}{dur}[vbase]")
    }
}

fn build_cover_base(
    w: u32,
    h: u32,
    bg: &str,
    rect: Option<&VideoRect>,
    object_fit: &str,
    duration_secs: Option<&str>,
) -> String {
    build_cover_base_with_bg(
        w,
        h,
        bg,
        None,
        "solid",
        180,
        rect,
        object_fit,
        duration_secs,
    )
}

fn build_cover_base_with_bg(
    w: u32,
    h: u32,
    bg: &str,
    bg_to: Option<&str>,
    kind: &str,
    angle: u32,
    rect: Option<&VideoRect>,
    object_fit: &str,
    duration_secs: Option<&str>,
) -> String {
    let overlay_end = if duration_secs.is_some() {
        ":shortest=1"
    } else {
        ""
    };
    let vbase = background_source_filter(w, h, bg, bg_to, kind, angle, duration_secs);
    if let Some(r) = rect {
        let scale = cover_scale_filter(object_fit, r.width, r.height);
        format!(
            "{vbase};\
             [0:v]{scale},format=rgba[vcover];\
             [vbase][vcover]overlay={}:{}:format=auto{overlay_end},format=yuv420p[v0]",
            r.x, r.y
        )
    } else {
        let cover_max = COVER_MAX_KARAOKE.min(w.saturating_sub(80)).min(h.saturating_sub(220));
        let scale = cover_scale_filter(object_fit, cover_max, cover_max);
        format!(
            "{vbase};\
             [0:v]{scale},format=rgba[vcover];\
             [vbase][vcover]overlay=(W-w)/2:(H-h)/2:format=auto{overlay_end},format=yuv420p[v0]"
        )
    }
}

/// Split overlay title into lines that fit the video width.
pub fn wrap_title_lines(text: &str, max_lines: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return Vec::new();
    }

    let max_chars = 22usize;
    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in words {
        let extra = if current.is_empty() {
            word.len()
        } else {
            word.len() + 1
        };
        if !current.is_empty() && current.len() + extra > max_chars {
            lines.push(current);
            current = word.to_string();
            if lines.len() >= max_lines {
                if let Some(last) = lines.last_mut() {
                    if !last.ends_with('…') {
                        last.push('…');
                    }
                }
                return lines;
            }
        } else if current.is_empty() {
            current = word.to_string();
        } else {
            current.push(' ');
            current.push_str(word);
        }
    }
    if !current.is_empty() && lines.len() < max_lines {
        lines.push(current);
    }
    lines
}

/// Static cover image + audio → H.264/AAC MP4 (WhatsApp-friendly preview).
pub fn export_still_video_with_audio(
    audio: &Path,
    cover: &Path,
    dest: &Path,
    opts: &ShareVideoExportOptions,
) -> Result<()> {
    ensure_ffmpeg()?;
    if !audio.is_file() {
        anyhow::bail!("audio file missing: {}", audio.display());
    }
    if !cover.is_file() {
        anyhow::bail!("cover image missing: {}", cover.display());
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).context("create export dir")?;
    }

    let w = opts.width;
    let h = opts.height;
    let audio_duration_ms = probe_audio_duration_ms(audio).unwrap_or(0);
    let duration_secs = format_duration_secs(audio_duration_ms);
    let karaoke = if opts.karaoke_enabled {
        prepare_karaoke_ass(opts, dest, audio_duration_ms)?
    } else {
        None
    };
    emit_progress(opts, "render", 0.05, "Przygotowuję napisy…");

    let (filter, out_label, extra_inputs) = build_render_filter(
        w,
        h,
        karaoke.as_deref(),
        opts,
        duration_secs.as_deref(),
    );

    if let Some(logo) = opts.watermark_logo.as_ref().filter(|p| p.is_file()) {
        return export_with_logo_overlay(
            audio,
            cover,
            dest,
            &filter,
            &out_label,
            logo,
            w,
            opts,
            duration_secs.as_deref(),
        );
    }

    run_ffmpeg_render(
        audio,
        cover,
        dest,
        &filter,
        &out_label,
        &extra_inputs,
        opts,
        duration_secs.as_deref(),
    )
}

fn format_duration_secs(ms: u64) -> Option<String> {
    if ms < 50 {
        None
    } else {
        Some(format!("{:.3}", ms as f64 / 1000.0))
    }
}

fn cover_scale_filter(object_fit: &str, rw: u32, rh: u32) -> String {
    match object_fit {
        "cover" => format!("scale={rw}:{rh}:force_original_aspect_ratio=increase,crop={rw}:{rh}"),
        "fill" => format!("scale={rw}:{rh}"),
        _ => format!("scale={rw}:{rh}:force_original_aspect_ratio=decrease"),
    }
}

fn hex_to_ffmpeg_color(hex: &str) -> String {
    let trimmed = hex.trim().trim_start_matches('#');
    if trimmed.len() == 6 {
        format!("0x{trimmed}")
    } else {
        BG_COLOR.to_string()
    }
}

fn color_with_alpha(hex: &str, opacity: f32) -> String {
    let base = hex_to_ffmpeg_color(hex);
    let alpha = opacity.clamp(0.05, 1.0);
    if base.contains('@') {
        base
    } else {
        format!("{base}@{alpha:.2}")
    }
}

fn append_decorative_layers(
    chain: &mut String,
    last: &mut String,
    layers: &[DecorativeLayerSpec],
    pin_shortest: bool,
) -> Vec<ExtraInput> {
    let mut extra_inputs: Vec<ExtraInput> = Vec::new();
    let mut step = 0u32;

    for spec in layers {
        match spec {
            DecorativeLayerSpec::Shape {
                rect,
                fill,
                stroke,
                stroke_width,
                opacity,
                ..
            } => {
                step += 1;
                let next = format!("vshape{step}");
                let fill_c = color_with_alpha(fill, *opacity);
                let mut filters = vec![format!(
                    "drawbox=x={}:y={}:w={}:h={}:color={}:t=fill",
                    rect.x, rect.y, rect.width, rect.height, fill_c
                )];
                if *stroke_width > 0 && !stroke.trim().is_empty() {
                    let stroke_c = color_with_alpha(stroke, *opacity);
                    filters.push(format!(
                        "drawbox=x={}:y={}:w={}:h={}:color={}:t={stroke_width}",
                        rect.x, rect.y, rect.width, rect.height, stroke_c
                    ));
                }
                chain.push_str(&format!(";[{last}]{}[{next}]", filters.join(",")));
                *last = next;
            }
            DecorativeLayerSpec::CustomText { .. } => {
                step += 1;
                let next = format!("vtext{step}");
                let (font, _) = default_drawtext_font().unwrap_or_else(|| {
                    ("Arial".to_string(), false)
                });
                let filter = custom_text_drawtext_filter(spec, &font);
                chain.push_str(&format!(";[{last}]{filter}[{next}]"));
                *last = next;
            }
            DecorativeLayerSpec::Image {
                path,
                rect,
                object_fit,
                opacity,
            } => {
                step += 1;
                let input_idx = 2 + extra_inputs.len() as u32;
                extra_inputs.push(ExtraInput {
                    path: path.clone(),
                    kind: ExtraInputKind::Image,
                });
                let scale = cover_scale_filter(object_fit, rect.width, rect.height);
                let img_l = format!("vimg{step}");
                let next = format!("vov{step}");
                let alpha = opacity.clamp(0.05, 1.0);
                let overlay_end = if pin_shortest { ":shortest=1" } else { "" };
                chain.push_str(&format!(
                    ";[{input_idx}:v]{scale},format=rgba,colorchannelmixer=aa={alpha:.3}[{img_l}];\
                     [{last}][{img_l}]overlay={}:{}:format=auto{overlay_end},format=yuv420p[{next}]",
                    rect.x, rect.y
                ));
                *last = next;
            }
            DecorativeLayerSpec::VideoLoop {
                path,
                rect,
                rotation_speed,
                opacity,
            } => {
                if rect.width < 4 || rect.height < 4 {
                    continue;
                }
                step += 1;
                let input_idx = 2 + extra_inputs.len() as u32;
                extra_inputs.push(ExtraInput {
                    path: path.clone(),
                    kind: ExtraInputKind::Video,
                });
                let next = format!("vvloop{step}");
                let alpha = opacity.clamp(0.05, 1.0);
                // Pad the source to a square big enough to contain the
                // rotated bounding box, then rotate around the centre.
                let square = rect.width.max(rect.height).max(8);
                let scaled_l = format!("vvidscaled{step}");
                let padded_l = format!("vvpadded{step}");
                let rotated_l = format!("vvrotated{step}");
                let alpha_l = format!("vvalpha{step}");
                // Pre-compute offsets on Rust side (no commas in expressions).
                let offset_x = (square - rect.width) / 2;
                let offset_y = (square - rect.height) / 2;
                let speed = rotation_speed.max(0.0);
                // Pipeline strategy (verified empirically with the bundled
                // `tshub_baner.mp4`, which has 121 H.264 B-frames @ 30fps):
                //
                //  1. `-stream_loop -1` keeps the demuxer looping input
                //     frames past EOF so the overlay stream never runs out.
                //  2. `fps=25` normalises the source frame rate and
                //     discards B-frame reordering, so each output frame
                //     corresponds to a fixed 1/25s display step.
                //  3. `setpts=N/(25*TB)` rewrites every output frame's PTS
                //     to N/25 seconds — i.e. a pure function of the output
                //     frame index. This is critical: without it, when the
                //     demuxer seeks back to the start on each loop
                //     iteration the original PTS resets to 0 and the
                //     rotate filter's `t` jumps back, producing a
                //     visible snap in the rotation angle.
                //  4. `rotate=t*2*PI*speed` then rotates smoothly forever.
                chain.push_str(&format!(
                    ";[{input_idx}:v]scale={sw}:{sh}:force_original_aspect_ratio=decrease,setsar=1,fps={fps},setpts=N/({fps}*TB)[{scaled_l}];\
                     [{scaled_l}]pad={sq}:{sq}:(ow-iw)/2:(oh-ih)/2:color=0x00000000@0,setsar=1[{padded_l}];\
                     [{padded_l}]rotate=t*2*PI*{speed:.4}:c=0x00000000@0:ow={sq}:oh={sq},setsar=1[{rotated_l}];\
                     [{rotated_l}]format=rgba,colorchannelmixer=aa={alpha:.3}[{alpha_l}];\
                     [{last}][{alpha_l}]overlay=x={rx}+{ox}:y={ry}+{oy}:format=auto[{next}]",
                    sw = rect.width,
                    sh = rect.height,
                    fps = VIDEO_FPS,
                    sq = square,
                    scaled_l = scaled_l,
                    padded_l = padded_l,
                    rotated_l = rotated_l,
                    alpha_l = alpha_l,
                    speed = speed,
                    alpha = alpha,
                    rx = rect.x,
                    ox = offset_x,
                    ry = rect.y,
                    oy = offset_y,
                    next = next,
                ));
                *last = next;
            }
        }
    }

    extra_inputs
}

fn build_render_filter(
    w: u32,
    h: u32,
    ass: Option<&Path>,
    opts: &ShareVideoExportOptions,
    duration_secs: Option<&str>,
) -> (String, String, Vec<ExtraInput>) {
    let mut chain = build_cover_base_with_bg(
        w,
        h,
        opts.bg_color.as_str(),
        opts.bg_gradient_to.as_deref(),
        &opts.bg_gradient_kind,
        opts.bg_gradient_angle,
        opts.cover_rect.as_ref(),
        &opts.cover_object_fit,
        duration_secs,
    );
    let mut last = "v0".to_string();

    let extra_inputs = append_decorative_layers(
        &mut chain,
        &mut last,
        &opts.decorative_layers,
        duration_secs.is_some(),
    );

    if let Some(ass_path) = ass {
        chain.push_str(&format!(
            ";[{last}]{}[vsubs]",
            ass_filter(ass_path)
        ));
        last = "vsubs".to_string();
    } else if let Some((font, _bold)) = default_drawtext_font() {
        let title_filters = static_title_drawtext_filters(&opts.title_lines, h, &font);
        if !title_filters.is_empty() {
            chain.push_str(&format!(";[{last}]{title_filters}[vtitle]"));
            last = "vtitle".to_string();
        }
    }

    if let Some((font, _)) = default_drawtext_font() {
        if let Some(footer) = opts.footer_line.as_deref().filter(|s| !s.is_empty()) {
            chain.push_str(&format!(
                ";[{last}]{}[vfoot]",
                footer_drawtext_filter(footer, h, &font, opts.footer_rect.as_ref(), opts.footer_font_size, &opts.footer_align)
            ));
            last = "vfoot".to_string();
        }
        chain.push_str(&format!(
            ";[{last}]{}[vout]",
            watermark_drawtext_filter(
                &opts.watermark_text,
                w,
                &font,
                opts.watermark_rect.as_ref(),
                opts.watermark_opacity,
            )
        ));
        last = "vout".to_string();
    }

    (chain, last, extra_inputs)
}

fn static_title_drawtext_filters(title_lines: &[String], h: u32, font: &str) -> String {
    let line_count = title_lines.len().min(3);
    if line_count == 0 {
        return String::new();
    }
    let fontsize = match line_count {
        1 => 38,
        2 => 32,
        _ => 28,
    };
    let line_step = fontsize + 14;
    let block_h = line_count as u32 * line_step;
    let start_y = h.saturating_sub(FOOTER_PAD + 36 + block_h);
    let mut parts = Vec::new();
    for (i, line) in title_lines.iter().take(3).enumerate() {
        let escaped = escape_drawtext(line);
        let y = start_y + i as u32 * line_step;
        parts.push(format!(
            "drawtext=fontfile='{font}':text='{escaped}':\
             fontsize={fontsize}:fontcolor=white:\
             box=1:boxcolor=0x000000@0.72:boxborderw=18:\
             x=(w-text_w)/2:y={y}"
        ));
    }
    parts.join(",")
}

fn footer_drawtext_filter(
    footer: &str,
    h: u32,
    font: &str,
    rect: Option<&VideoRect>,
    font_size: u32,
    align: &str,
) -> String {
    let escaped = escape_drawtext(footer);
    let (x, y) = if let Some(r) = rect {
        let x_expr = match align {
            "left" => format!("{}", r.x),
            "right" => format!("{}+{}-text_w", r.x, r.width),
            _ => format!("{}+({}-text_w)/2", r.x, r.width),
        };
        (x_expr, r.y)
    } else {
        ("(w-text_w)/2".to_string(), h.saturating_sub(FOOTER_PAD))
    };
    format!(
        "drawtext=fontfile='{font}':text='{escaped}':\
         fontsize={font_size}:fontcolor=0xA8B0C0@0.92:\
         x={x}:y={y}"
    )
}

fn watermark_drawtext_filter(
    watermark: &str,
    w: u32,
    font: &str,
    rect: Option<&VideoRect>,
    opacity: f32,
) -> String {
    if watermark.trim().is_empty() {
        return "null".to_string();
    }
    let escaped = escape_drawtext(watermark);
    let alpha = opacity.clamp(0.05, 1.0);
    let (x, y) = if let Some(r) = rect {
        (format!("{}", r.x), r.y)
    } else {
        (format!("{}-text_w", w.saturating_sub(24)), 24)
    };
    format!(
        "drawtext=fontfile='{font}':text='{escaped}':\
         fontsize=22:fontcolor=0xFFFFFF@{alpha:.2}:\
         x={x}:y={y}"
    )
}

/// Normalise a hex color (`#RRGGBB`, `0xRRGGBB`, `RRGGBB`) to `"0xRRGGBB"`.
/// Returns `None` for empty / malformed input. Anything that's not
/// 6 hex digits (e.g. CSS names, alpha channel) falls back to white.
fn normalize_hex_color(input: &str, fallback: &str) -> String {
    let mut s = input.trim();
    if s.is_empty() {
        return fallback.to_string();
    }
    s = s.trim_start_matches('#').trim_start_matches("0x").trim_start_matches("0X");
    if s.len() >= 6 && s.is_ascii() && s[..6].chars().all(|c| c.is_ascii_hexdigit()) {
        return format!("0x{}", &s[..6]);
    }
    fallback.to_string()
}

/// Build a drawtext filter expression for a single line of `CustomText`.
/// Returns `None` if anything in the line would produce an invalid filter.
///
/// IMPORTANT: filter values must not contain literal commas — in ffmpeg
/// the comma is the chain separator, so `if(...)` or `gte(a,b)` would
/// split the filter graph and crash ffmpeg with `EINVAL`. We stick to
/// plain integer arithmetic and `+`, `-`, `*`, `/`, `(`, `)` only.
fn custom_text_line_filter(
    font: &str,
    line: &str,
    rect: &VideoRect,
    font_size: u32,
    fontcolor: &str,
    align: &str,
    y_offset_within_rect: u32,
    background: bool,
    boxcolor: Option<&str>,
) -> Option<String> {
    if line.trim().is_empty() {
        return None;
    }
    // Newlines or other ASCII control chars would break the `text='...'`
    // value — refuse to render rather than crashing ffmpeg.
    if line.chars().any(|c| {
        let code = c as u32;
        code < 0x20 && code != b'\t' as u32
    }) {
        return None;
    }
    let escaped = escape_drawtext(line);

    // Horizontal alignment — pure integer arithmetic, no `if()` /
    // `gte()` (their commas break ffmpeg's filter-chain parser and
    // produce EINVAL during parse).
    let x_expr = match align {
        "left" => format!("{}", rect.x + 8),
        "right" => format!("{}-text_w-8", rect.x + rect.width),
        // `center` — fixed at rect center. If text is wider than the
        // rect, it overflows the right edge — visually less ideal
        // but never produces EINVAL.
        _ => format!("{}+({}-text_w)/2", rect.x, rect.width),
    };

    let line_y = rect.y + y_offset_within_rect;

    // `fontcolor` is a strict `0xRRGGBB`; alpha would break older
    // ffmpeg builds. Box opacity goes through `boxcolor=...@alpha`.
    let mut filter = format!(
        "drawtext=fontfile='{font}':text='{escaped}':\
         fontsize={font_size}:fontcolor={fontcolor}:\
         x={x_expr}:y={line_y}"
    );

    if background {
        let bg = boxcolor.unwrap_or("0x000000@0.55");
        filter.push_str(&format!(":box=1:boxcolor={bg}:boxborderw=12"));
    }

    Some(filter)
}

/// Build a (possibly multi-)drawtext filter chain for a `CustomText`
/// layer rendered into the layer's rect. Splits text on `\n` and emits
/// one drawtext per non-empty line stacked vertically. Returns `"null"`
/// when the text is empty / invalid so the chain stays a no-op.
fn custom_text_drawtext_filter(layer: &DecorativeLayerSpec, font: &str) -> String {
    let DecorativeLayerSpec::CustomText {
        rect,
        text,
        font_size,
        color,
        background,
        background_color,
        background_opacity,
        align,
        vertical_align,
        ..
    } = layer
    else {
        return "null".to_string();
    };

    if rect.width < 16 || rect.height < 8 {
        return "null".to_string();
    }

    // Split on CR / LF / CRLF and trim trailing whitespace per line.
    let mut lines: Vec<&str> = text
        .split(|c| c == '\n' || c == '\r')
        .map(|l| l.trim_end())
        .collect();
    if lines.iter().all(|l| l.trim().is_empty()) {
        return "null".to_string();
    }
    // Drop leading/trailing empty lines so the block doesn't render whitespace boxes.
    while lines.first().map(|l| l.trim().is_empty()).unwrap_or(false) {
        lines.remove(0);
    }
    while lines.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
        lines.pop();
    }
    if lines.is_empty() {
        return "null".to_string();
    }

    let fontcolor = normalize_hex_color(color, "0xFFFFFF");
    let bg_alpha = background_opacity.clamp(0.0, 1.0);
    let boxcolor_str = if *background {
        let bg = normalize_hex_color(background_color, "0x000000");
        Some(if (bg_alpha - 1.0).abs() < f32::EPSILON {
            bg
        } else {
            format!("{bg}@{bg_alpha:.2}")
        })
    } else {
        None
    };

    // Compute vertical layout.
    let line_height = (*font_size as f32 * 1.25).round() as u32;
    let total_h = line_height * lines.len() as u32;
    let mut y_offset: u32 = match vertical_align.as_str() {
        "top" => 0,
        "bottom" => rect.height.saturating_sub(total_h),
        // "middle"
        _ => rect.height.saturating_sub(total_h) / 2,
    };
    // Clamp into rect so the first line isn't above the rect.
    if y_offset + total_h > rect.height {
        y_offset = 0;
    }

    let mut parts: Vec<String> = Vec::with_capacity(lines.len());
    for (idx, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            y_offset += line_height;
            continue;
        }
        let offset = y_offset + (idx as u32 * line_height);
        match custom_text_line_filter(
            font,
            line,
            rect,
            *font_size,
            &fontcolor,
            align,
            offset,
            *background,
            boxcolor_str.as_deref(),
        ) {
            Some(f) => parts.push(f),
            None => continue,
        }
    }

    if parts.is_empty() {
        return "null".to_string();
    }
    if parts.len() == 1 {
        return parts.remove(0);
    }
    // Compose the per-line filters as a comma-joined expression so the
    // incoming stream is fed through all of them at once.
    parts.join(",")
}

fn emit_progress(opts: &ShareVideoExportOptions, phase: &str, percent: f32, message: &str) {
    emit_progress_with_eta(opts, phase, percent, message, None);
}

fn emit_progress_with_eta(
    opts: &ShareVideoExportOptions,
    phase: &str,
    percent: f32,
    message: &str,
    eta_ms: Option<u64>,
) {
    if let (Some(id), Some(cb)) = (opts.export_id.as_deref(), opts.progress.as_ref()) {
        cb(Mp4ExportProgress {
            id: id.to_string(),
            phase: phase.to_string(),
            percent,
            message: message.to_string(),
            eta_ms,
        });
    }
}

fn resolve_karaoke_words(opts: &ShareVideoExportOptions, audio_duration_ms: u64) -> Option<Vec<TimedWord>> {
    if let Some(json_path) = opts.subtitle_json.as_ref().filter(|p| p.is_file()) {
        if let Ok(bytes) = std::fs::read(json_path) {
            if let Ok(words) =
                parse_minimax_subtitles_with_duration(&bytes, Some(audio_duration_ms))
            {
                return Some(expand_sentences_to_words(words));
            }
        }
    }

    let text = opts.fallback_karaoke_text.as_deref()?.trim();
    if text.is_empty() || audio_duration_ms == 0 {
        return None;
    }
    Some(estimate_word_timings_from_text(text, audio_duration_ms))
}

fn prepare_karaoke_ass(
    opts: &ShareVideoExportOptions,
    dest: &Path,
    audio_duration_ms: u64,
) -> Result<Option<PathBuf>> {
    if !opts.karaoke_enabled {
        return Ok(None);
    }
    let words = match resolve_karaoke_words(opts, audio_duration_ms) {
        Some(w) if !w.is_empty() => w,
        _ => return Ok(None),
    };
    let ass_path = dest.with_extension("ass");
    let margin_v = opts
        .karaoke_margin_v
        .unwrap_or_else(|| 62u32.min(opts.height.saturating_sub(120)));
    let font_size = opts.karaoke_font_size.unwrap_or(40);
    write_karaoke_ass_with_layout(
        &words,
        &ass_path,
        &KaraokeAssLayout {
            play_res_x: opts.width,
            play_res_y: opts.height,
            font_size,
            margin_v,
            clip: opts.karaoke_rect.map(|r| (r.x, r.y, r.width, r.height)),
            scroll_mode: KaraokeScrollMode::parse(&opts.karaoke_scroll_mode),
            audio_end_ms: Some(audio_duration_ms),
        },
    )?;
    Ok(Some(ass_path))
}

fn export_with_logo_overlay(
    audio: &Path,
    cover: &Path,
    dest: &Path,
    base_filter: &str,
    out_label: &str,
    logo: &Path,
    w: u32,
    opts: &ShareVideoExportOptions,
    duration_secs: Option<&str>,
) -> Result<()> {
    let logo_px = 56u32;
    let overlay_end = if duration_secs.is_some() {
        ":shortest=1"
    } else {
        ""
    };
    let filter = format!(
        "{base_filter};\
         [2:v]scale={logo_px}:{logo_px}:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=0.42[wm];\
         [{out_label}][wm]overlay={}:24:format=auto{overlay_end},format=yuv420p[vfinal]",
        w.saturating_sub(logo_px + 20)
    );

    emit_progress(opts, "render", 0.08, "Renderuję wideo…");
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-loglevel").arg("info");
    push_looped_still_args(&mut cmd, cover, duration_secs);
    cmd.arg("-i").arg(audio);
    push_looped_still_args(&mut cmd, logo, duration_secs);
    cmd.arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[vfinal]")
        .arg("-map")
        .arg("1:a");
    push_mp4_encode_args(&mut cmd, duration_secs);
    cmd.arg(dest).stderr(Stdio::piped());
    let child = cmd.spawn().context("spawn ffmpeg for mp4 export with logo")?;

    wait_ffmpeg_with_progress(child, probe_audio_duration_ms(audio).unwrap_or(0), opts)
}

fn run_ffmpeg_render(
    audio: &Path,
    cover: &Path,
    dest: &Path,
    filter: &str,
    out_label: &str,
    extra_inputs: &[ExtraInput],
    opts: &ShareVideoExportOptions,
    duration_secs: Option<&str>,
) -> Result<()> {
    emit_progress(opts, "render", 0.08, "Renderuję wideo…");
    // Persist the filter chain next to the destination so the user can
    // inspect it when something goes wrong (parse error, EINVAL, etc.).
    let filter_log = dest.with_extension("ffmpeg-filter.log");
    if let Err(e) = std::fs::write(&filter_log, filter) {
        eprintln!("warn: write filter log: {e}");
    }
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-loglevel").arg("verbose");
    push_looped_still_args(&mut cmd, cover, duration_secs);
    cmd.arg("-i").arg(audio);
    for inp in extra_inputs {
        match inp.kind {
            ExtraInputKind::Image => {
                push_looped_still_args(&mut cmd, &inp.path, duration_secs);
            }
            ExtraInputKind::Video => {
                push_video_loop_args(&mut cmd, &inp.path, duration_secs);
            }
        }
    }
    cmd.arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg(format!("[{out_label}]"))
        .arg("-map")
        .arg("1:a");
    push_mp4_encode_args(&mut cmd, duration_secs);
    cmd.arg(dest).stderr(Stdio::piped());
    let child = cmd.spawn().context("spawn ffmpeg for mp4 export")?;

    let res = wait_ffmpeg_with_progress(
        child,
        probe_audio_duration_ms(audio).unwrap_or(0),
        opts,
    );
    if res.is_err() {
        // Surface the filter-log path so the user can investigate.
        emit_progress(
            opts,
            "error",
            0.0,
            &format!("Filtr zapisany w {}", filter_log.display()),
        );
    }
    res
}

fn push_looped_still_args(cmd: &mut Command, path: &Path, duration_secs: Option<&str>) {
    cmd.arg("-loop")
        .arg("1")
        .arg("-framerate")
        .arg(VIDEO_FPS_ARG);
    if let Some(d) = duration_secs {
        cmd.arg("-t").arg(d);
    }
    cmd.arg("-i").arg(path);
}

/// Add a video input that loops indefinitely until `-shortest` cuts it.
/// `duration_secs` is the optional `-t` cap (matches the cover/audio length).
///
/// PTS continuity across loop iterations is handled INSIDE the filter
/// graph via `setpts=N/(25*TB)`, which rewrites output timestamps as a
/// pure function of the output frame index. Without that, the demuxer's
/// PTS reset on each seek-back would cause the rotate filter's `t` to
/// jump, snapping the angle back to 0 every ~4s.
fn push_video_loop_args(cmd: &mut Command, path: &Path, duration_secs: Option<&str>) {
    cmd.arg("-stream_loop").arg("-1");
    if let Some(d) = duration_secs {
        cmd.arg("-t").arg(d);
    }
    cmd.arg("-i").arg(path);
}

fn push_mp4_encode_args(cmd: &mut Command, duration_secs: Option<&str>) {
    cmd.arg("-c:v")
        .arg("libx264")
        .arg("-tune")
        .arg("stillimage")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-r")
        .arg(VIDEO_FPS_ARG)
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("128k")
        .arg("-shortest")
        .arg("-max_interleave_delta")
        .arg("0");
    if let Some(d) = duration_secs {
        cmd.arg("-t").arg(d);
    }
}

fn wait_ffmpeg_with_progress(
    mut child: std::process::Child,
    duration_ms: u64,
    opts: &ShareVideoExportOptions,
) -> Result<()> {
    let stderr = child.stderr.take();
    let duration_s = (duration_ms as f32 / 1000.0).max(0.1);
    let progress_cb = opts.progress.clone();
    let export_id = opts.export_id.clone();

    // Drain stderr in a worker. We keep the last 60 log lines (most
    // `time=` updates are filtered out, so the rest are actual error
    // messages from ffmpeg) and reuse them to enrich the final error.
    let stderr_handle = stderr.map(|stderr| {
        let progress_cb = progress_cb.clone();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            let mut last_emit_ms: u64 = 0;
            let mut tail: Vec<String> = Vec::new();
            for line in reader.lines().map_while(Result::ok) {
                if let Some(secs) = parse_ffmpeg_time_seconds(&line) {
                    let pct = (secs / duration_s).clamp(0.08, 0.95);
                    let eta_ms = if secs >= duration_s {
                        0u64
                    } else {
                        ((duration_s - secs).max(0.0) * 1000.0) as u64
                    };
                    if let (Some(id), Some(cb)) =
                        (export_id.as_deref(), progress_cb.as_ref())
                    {
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        if now_ms.saturating_sub(last_emit_ms) >= 200 {
                            last_emit_ms = now_ms;
                            cb(Mp4ExportProgress {
                                id: id.to_string(),
                                phase: "render".to_string(),
                                percent: pct,
                                message: "Renderuję wideo…".to_string(),
                                eta_ms: Some(eta_ms),
                            });
                        }
                    }
                } else {
                    tail.push(line);
                    if tail.len() > 60 {
                        tail.remove(0);
                    }
                }
            }
            tail
        })
    });

    let status = child.wait().context("wait ffmpeg")?;
    let stderr_tail: Vec<String> = stderr_handle
        .and_then(|h| h.join().ok())
        .unwrap_or_default();

    if !status.success() {
        // Compose a richer diagnostic: surface the *first* non-empty
        // tail line (typically the actual error) plus up to 5 most
        // recent lines for context. `Error : Invalid argument` alone
        // is uninformative; surrounding lines usually name the filter.
        let non_empty: Vec<&str> = stderr_tail
            .iter()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();
        let first = non_empty.first().copied().unwrap_or("");
        let recent: Vec<&str> = non_empty.iter().rev().take(5).copied().collect();
        let mut parts: Vec<String> = Vec::new();
        if !first.is_empty() {
            parts.push(first.to_string());
        }
        if !recent.is_empty() {
            let joined = recent.into_iter().rev().collect::<Vec<_>>().join(" | ");
            if !parts.is_empty() && joined != first {
                parts.push(joined);
            } else if joined != first {
                parts.push(joined);
            }
        }
        let diagnostic = parts.join(" — ");
        let msg = if diagnostic.is_empty() {
            format!("ffmpeg mp4 export failed (exit {status})")
        } else {
            format!("ffmpeg mp4 export failed (exit {status}): {diagnostic}")
        };
        // Surface the failure to the studio log panel.
        emit_progress_with_eta(opts, "error", 0.0, &msg, Some(0));
        return Err(anyhow!(msg));
    }
    emit_progress(opts, "render", 0.98, "Finalizuję…");
    Ok(())
}

pub fn probe_audio_duration_ms(audio: &Path) -> Result<u64> {
    ensure_ffmpeg()?;
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(audio)
        .output()
        .context("spawn ffprobe")?;
    if !output.status.success() {
        anyhow::bail!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let secs: f64 = raw.trim().parse().unwrap_or(0.0);
    Ok((secs * 1000.0).round() as u64)
}

fn parse_ffmpeg_time_seconds(line: &str) -> Option<f32> {
    let idx = line.find("time=")?;
    let rest = &line[idx + 5..];
    let token = rest.split_whitespace().next()?;
    let parts: Vec<&str> = token.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f32 = parts[0].parse().ok()?;
    let m: f32 = parts[1].parse().ok()?;
    let s: f32 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

fn ass_filter(ass: &Path) -> String {
    let file = ffmpeg_filter_path(ass);
    if let Some(dir) = subtitle_fonts_dir() {
        format!("ass='{file}':fontsdir='{dir}'")
    } else {
        format!("ass='{file}'")
    }
}

fn subtitle_fonts_dir() -> Option<String> {
    #[cfg(windows)]
    {
        let path = r"C:\Windows\Fonts";
        if Path::new(path).is_dir() {
            return Some(ffmpeg_path_escape(path));
        }
    }
    #[cfg(target_os = "macos")]
    {
        for path in [
            "/System/Library/Fonts",
            "/Library/Fonts",
            "/System/Library/Fonts/Supplemental",
        ] {
            if Path::new(path).is_dir() {
                return Some(ffmpeg_path_escape(path));
            }
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for path in ["/usr/share/fonts", "/usr/local/share/fonts"] {
            if Path::new(path).is_dir() {
                return Some(ffmpeg_path_escape(path));
            }
        }
    }
    None
}

fn default_drawtext_font() -> Option<(String, bool)> {
    #[cfg(windows)]
    {
        let candidates = [
            (r"C:\Windows\Fonts\seguisb.ttf", true),
            (r"C:\Windows\Fonts\segoeuib.ttf", true),
            (r"C:\Windows\Fonts\arialbd.ttf", true),
            (r"C:\Windows\Fonts\segoeui.ttf", false),
            (r"C:\Windows\Fonts\arial.ttf", false),
        ];
        for (path, bold) in candidates {
            if Path::new(path).is_file() {
                return Some((ffmpeg_path_escape(path), bold));
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        for (path, bold) in [
            ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", true),
            ("/System/Library/Fonts/Supplemental/Arial.ttf", false),
        ] {
            if Path::new(path).is_file() {
                return Some((ffmpeg_path_escape(path), bold));
            }
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for (path, bold) in [
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", true),
            ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", false),
        ] {
            if Path::new(path).is_file() {
                return Some((ffmpeg_path_escape(path), bold));
            }
        }
    }
    None
}

fn ffmpeg_path_escape(path: &str) -> String {
    path.replace('\\', "/").replace(':', "\\:")
}

fn ffmpeg_filter_path(path: &Path) -> String {
    ffmpeg_path_escape(&path.to_string_lossy())
}

fn escape_drawtext(input: &str) -> String {
    let mut out = String::new();
    for c in input.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            ':' => out.push_str("\\:"),
            '\'' => out.push_str("\\'"),
            '%' => out.push_str("\\%"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_title_splits_long_text() {
        let lines = wrap_title_lines(
            "To jest bardzo długi tytuł generacji który musi się zmieścić na ekranie",
            3,
        );
        assert!(lines.len() >= 2);
        assert!(lines.len() <= 3);
    }

    #[test]
    fn format_duration_secs_skips_tiny_and_formats_ms() {
        assert_eq!(format_duration_secs(0), None);
        assert_eq!(format_duration_secs(12), None);
        assert_eq!(format_duration_secs(12_345), Some("12.345".into()));
    }

    #[test]
    fn cover_base_pins_audio_duration_and_fps() {
        let rect = VideoRect {
            x: 40,
            y: 40,
            width: 400,
            height: 400,
        };
        let s = build_cover_base(720, 720, "0x12141a", Some(&rect), "contain", Some("8.500"));
        assert!(s.contains("r=25"), "{s}");
        assert!(s.contains("d=8.500"), "{s}");
        assert!(s.contains("shortest=1"), "{s}");
        assert!(!s.contains("r=1["), "{s}");
    }

    #[test]
    fn parse_rgb_accepts_hash_and_0x() {
        assert_eq!(parse_rgb("#2a1038"), (0x2a, 0x10, 0x38));
        assert_eq!(parse_rgb("0x050508"), (0x05, 0x05, 0x08));
    }

    #[test]
    fn linear_gradient_filter_uses_geq() {
        let s = background_source_filter(
            720,
            1280,
            "0x2a1038",
            Some("0x050508"),
            "linear",
            180,
            Some("8.500"),
        );
        assert!(s.contains("geq=r="), "{s}");
        assert!(s.contains("d=8.500"), "{s}");
        assert!(s.contains("[vbase]"), "{s}");
        assert!(!s.contains("r=1["), "{s}");
    }

    #[test]
    fn radial_gradient_escapes_geq_commas() {
        let s = background_source_filter(720, 720, "#12141a", Some("#000000"), "radial", 180, None);
        assert!(s.contains("hypot(X-W/2\\,Y-H/2)"), "{s}");
        assert!(s.contains("format=gbrp"), "{s}");
    }

    #[test]
    fn solid_background_skips_geq() {
        let s = background_source_filter(720, 720, "0x12141a", None, "solid", 180, Some("1.000"));
        assert!(!s.contains("geq="), "{s}");
        assert!(s.contains("color=c=0x12141a"), "{s}");
    }

    fn rect(x: u32, y: u32, w: u32, h: u32) -> VideoRect {
        VideoRect {
            x,
            y,
            width: w,
            height: h,
        }
    }

    #[test]
    fn custom_text_emits_single_line_when_no_newline() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(40, 500, 640, 120),
            text: "Hello world".into(),
            font_name: "Arial".into(),
            font_size: 36,
            color: "#FFFFFF".into(),
            background: false,
            background_color: "#000000".into(),
            background_opacity: 0.55,
            align: "center".into(),
            vertical_align: "middle".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        assert!(f.starts_with("drawtext="), "{f}");
        assert!(f.contains("text='Hello world'"), "{f}");
        // fontcolor must be a clean 0xRRGGBB (no @alpha).
        assert!(f.contains("fontcolor=0xFFFFFF"), "{f}");
        assert!(!f.contains("fontcolor=0xFFFFFF@"), "{f}");
        // No `box=` when background is off.
        assert!(!f.contains("box="), "{f}");
        // No embedded control chars / multi-line artefacts.
        assert!(!f.contains('\n'), "{f}");
        // CRITICAL: no literal commas inside option values — they are
        // the filter-chain separator and trigger EINVAL.
        assert!(!f.contains(','), "{f}");
    }

    #[test]
    fn custom_text_filter_chain_has_no_unintended_commas() {
        // Try every align / verticalAlign combination.
        for align in ["left", "center", "right"] {
            for valign in ["top", "middle", "bottom"] {
                let layer = DecorativeLayerSpec::CustomText {
                    rect: rect(40, 40, 640, 640),
                    text: "Linia 1\nLinia druga\nTrzecia\n\nPusta wyżej".into(),
                    font_name: "Arial".into(),
                    font_size: 28,
                    color: "#FF8800".into(),
                    background: true,
                    background_color: "#222222".into(),
                    background_opacity: 0.6,
                    align: align.into(),
                    vertical_align: valign.into(),
                    bold: false,
                    italic: false,
                };
                let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
                assert!(f.starts_with("drawtext="), "align={align} valign={valign}: {f}");
                // A multi-line layer produces multiple drawtext filters
                // joined by commas — every comma must separate two
                // independent drawtext=... expressions.
                let parts: Vec<&str> = f.split(',').collect();
                for p in &parts {
                    assert!(
                        p.trim_start().starts_with("drawtext="),
                        "non-drawtext segment in {f}: '{p}'"
                    );
                }
            }
        }
    }

    #[test]
    fn video_loop_appends_filter_chain_with_no_unintended_commas() {
        // Static rotation (speed=0).
        let mut chain_static = String::new();
        let mut last_static = "v0".to_string();
        let layer_static = DecorativeLayerSpec::VideoLoop {
            path: PathBuf::from("tshub_baner.mp4"),
            rect: rect(180, 40, 360, 360),
            rotation_speed: 0.0,
            opacity: 1.0,
        };
        let extras = append_decorative_layers(
            &mut chain_static,
            &mut last_static,
            &[layer_static],
            true,
        );
        assert_eq!(extras.len(), 1, "static rotation must add 1 video input");
        assert_eq!(extras[0].kind, ExtraInputKind::Video);
        // Rotating variant.
        let mut chain_rot = String::new();
        let mut last_rot = "v0".to_string();
        let layer_rot = DecorativeLayerSpec::VideoLoop {
            path: PathBuf::from("tshub_baner.mp4"),
            rect: rect(180, 40, 360, 360),
            rotation_speed: 0.5,
            opacity: 0.7,
        };
        let _ = append_decorative_layers(&mut chain_rot, &mut last_rot, &[layer_rot], true);
        for (label, chain) in [("static", &chain_static), ("rotating", &chain_rot)] {
            // No preceding cover chain in this test, so the chain
            // starts with the first decorative layer entry.
            assert!(chain.starts_with(";[2:v]"), "{label}: {chain}");
            // `setpts=N/(25*TB)` rewrites output PTS as a pure function
            // of output frame index — the only reliable way to keep the
            // rotate filter's `t` monotonic across the demuxer's seek
            // loops. We deliberately do NOT use the `loop=` filter
            // because `loop=-1:size=1:start=0` literally repeats the
            // first source frame, producing a static image.
            assert!(chain.contains("fps=25"),
                "{label}: expected explicit fps normalisation: {chain}");
            assert!(chain.contains("setpts=N/(25*TB)"),
                "{label}: expected setpts to renumber PTS: {chain}");
            assert!(!chain.contains("loop=-1:size=1"),
                "{label}: must not repeat only the first frame: {chain}");
            // The literal commas are ALLOWED only inside the alpha
            // pipeline: `format=rgba,colorchannelmixer=aa=…` — these
            // are filter separators inside the chain (legitimate).
            // Anything else that introduces a bare comma inside an
            // option value (e.g. `if(gte(...),...)`) breaks parsing.
            assert!(
                chain.contains("format=rgba,colorchannelmixer=aa="),
                "{label}: expected alpha pipeline comma: {chain}"
            );
            if chain.contains("rotate=") {
                assert!(chain.contains("rotate=t*2*PI*0.5") || chain.contains("rotate=t*2*PI*0.0"),
                    "{label}: expected rotate expression: {chain}");
            }
            assert!(chain.contains("overlay="), "{label}: expected overlay: {chain}");
            // No `if(` / `gte(` / `lte(` — these introduce commas.
            assert!(!chain.contains("if("), "{label}: bare `if(`: {chain}");
            assert!(!chain.contains("gte("), "{label}: bare `gte(`: {chain}");
            assert!(!chain.contains("lte("), "{label}: bare `lte(`: {chain}");
            // Parens must balance.
            assert_eq!(
                chain.matches("(").count(),
                chain.matches(")").count(),
                "{label}: unbalanced parens: {chain}"
            );
        }
    }

    #[test]
    fn custom_text_emits_one_filter_per_line() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(40, 100, 640, 400),
            text: "Linia pierwsza\nDruga linia\nTrzecia".into(),
            font_name: "Arial".into(),
            font_size: 40,
            color: "#FFFFFF".into(),
            background: true,
            background_color: "#000000".into(),
            background_opacity: 0.4,
            align: "center".into(),
            vertical_align: "middle".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        // No literal newlines preserved inside text='...'.
        assert!(!f.contains("\n"), "{f}");
        assert!(f.contains("text='Linia pierwsza'"), "{f}");
        assert!(f.contains("text='Druga linia'"), "{f}");
        assert!(f.contains("text='Trzecia'"), "{f}");
        // boxcolor should carry @alpha when opacity < 1.0.
        assert!(f.contains("boxcolor=0x000000@0.40"), "{f}");
        assert_eq!(f.matches("drawtext=").count(), 3, "{f}");
    }

    #[test]
    fn custom_text_escapes_colons_and_quotes() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(0, 0, 200, 60),
            text: "It's: 50% off!".into(),
            font_name: "Arial".into(),
            font_size: 28,
            color: "red".into(),
            background: false,
            background_color: "#000000".into(),
            background_opacity: 0.0,
            align: "left".into(),
            vertical_align: "top".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        // The apostrophe, colon and percent must be escaped; trailing `!`
        // is harmless and stays as-is.
        assert!(f.contains(r"text='It\'s\: 50\% off!'"), "{f}");
    }

    #[test]
    fn custom_text_drops_control_chars_in_text() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(0, 0, 200, 60),
            text: "ok\n\tinjection\x07bad".into(),
            font_name: "Arial".into(),
            font_size: 28,
            color: "#FFFFFF".into(),
            background: false,
            background_color: "#000000".into(),
            background_opacity: 0.0,
            align: "left".into(),
            vertical_align: "top".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        // Lines with embedded bell (\x07) must be dropped. After splitting
        // on \n we have ["ok", "\tinjection\x07bad"]. The second line is
        // rejected (bell char), so only the first remains.
        assert!(!f.contains("\x07"), "{f}");
        assert!(!f.contains('\t'), "{f}");
        assert_eq!(f.matches("drawtext=").count(), 1, "{f}");
    }

    #[test]
    fn custom_text_empty_returns_null() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(0, 0, 200, 60),
            text: "   \n  \n".into(),
            font_name: "Arial".into(),
            font_size: 28,
            color: "#FFFFFF".into(),
            background: false,
            background_color: "#000000".into(),
            background_opacity: 0.0,
            align: "left".into(),
            vertical_align: "top".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        assert_eq!(f, "null");
    }

    #[test]
    fn custom_text_strips_alpha_when_full_opacity() {
        let layer = DecorativeLayerSpec::CustomText {
            rect: rect(0, 0, 200, 60),
            text: "x".into(),
            font_name: "Arial".into(),
            font_size: 28,
            color: "#FFFFFF".into(),
            background: true,
            background_color: "#000000".into(),
            background_opacity: 1.0,
            align: "left".into(),
            vertical_align: "top".into(),
            bold: false,
            italic: false,
        };
        let f = custom_text_drawtext_filter(&layer, "C:/Windows/Fonts/arial.ttf");
        // No @ modifier when alpha is 1.0 (cleaner filter chain).
        assert!(!f.contains("@1.00"), "{f}");
        assert!(f.contains("boxcolor=0x000000"), "{f}");
    }
}
