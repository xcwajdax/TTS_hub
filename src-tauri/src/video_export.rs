use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

use crate::audio::ensure_ffmpeg;
use crate::minimax_subtitles::{
    estimate_word_timings_from_text, expand_sentences_to_words, parse_minimax_subtitles_with_duration,
    write_karaoke_ass_styled, TimedWord,
};
use crate::video_template::{VideoLayer, VideoRect, VideoTemplate};

/// Square 720×720 — good WhatsApp chat preview; small file size.
pub const WHATSAPP_VIDEO_SIZE: u32 = 720;

const COVER_MAX_KARAOKE: u32 = 380;
const COVER_MAX_STATIC: u32 = 480;
const FOOTER_PAD: u32 = 18;
const BG_COLOR: &str = "0x12141a";

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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mp4ExportProgress {
    pub id: String,
    pub phase: String,
    pub percent: f32,
    pub message: String,
}

pub struct ShareVideoExportOptions {
    pub width: u32,
    pub height: u32,
    pub template_id: Option<String>,
    pub bg_color: String,
    pub cover_rect: Option<VideoRect>,
    pub cover_object_fit: String,
    pub decorative_layers: Vec<DecorativeLayerSpec>,
    pub karaoke_enabled: bool,
    pub karaoke_margin_v: Option<u32>,
    pub karaoke_font_size: Option<u32>,
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
            cover_rect: None,
            cover_object_fit: "contain".to_string(),
            decorative_layers: Vec::new(),
            karaoke_enabled: true,
            karaoke_margin_v: None,
            karaoke_font_size: None,
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

pub fn apply_template_to_opts(opts: &mut ShareVideoExportOptions, template: &VideoTemplate) {
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
    opts.cover_rect = cover_rect;
    opts.karaoke_enabled = karaoke_enabled;
    opts.karaoke_margin_v = karaoke_margin_v;
    opts.karaoke_font_size = karaoke_font_size;
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

fn hex_to_ffmpeg_color(hex: &str) -> String {
    let trimmed = hex.trim().trim_start_matches('#');
    if trimmed.len() == 6 {
        format!("0x{trimmed}")
    } else {
        BG_COLOR.to_string()
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
    let karaoke = if opts.karaoke_enabled {
        prepare_karaoke_ass(opts, dest, audio_duration_ms)?
    } else {
        None
    };
    emit_progress(opts, "render", 0.05, "Przygotowuję napisy…");

    let (filter, out_label, extra_images) = build_render_filter(
        w,
        h,
        karaoke.as_deref(),
        opts,
    );

    if let Some(logo) = opts.watermark_logo.as_ref().filter(|p| p.is_file()) {
        return export_with_logo_overlay(audio, cover, dest, &filter, &out_label, logo, w, opts);
    }

    run_ffmpeg_render(audio, cover, dest, &filter, &out_label, &extra_images, opts)
}

fn cover_scale_filter(object_fit: &str, rw: u32, rh: u32) -> String {
    match object_fit {
        "cover" => format!("scale={rw}:{rh}:force_original_aspect_ratio=increase,crop={rw}:{rh}"),
        "fill" => format!("scale={rw}:{rh}"),
        _ => format!("scale={rw}:{rh}:force_original_aspect_ratio=decrease"),
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

fn build_cover_base(w: u32, h: u32, bg: &str, rect: Option<&VideoRect>, object_fit: &str) -> String {
    if let Some(r) = rect {
        let scale = cover_scale_filter(object_fit, r.width, r.height);
        format!(
            "color=c={bg}:s={w}x{h}:r=1[vbase];\
             [0:v]{scale},format=rgba[vcover];\
             [vbase][vcover]overlay={}:{}:format=auto,format=yuv420p[v0]",
            r.x, r.y
        )
    } else {
        let cover_max = COVER_MAX_KARAOKE.min(w.saturating_sub(80)).min(h.saturating_sub(220));
        format!(
            "[0:v]scale={cover_max}:{cover_max}:force_original_aspect_ratio=decrease,\
             pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={bg},format=yuv420p[v0]"
        )
    }
}

fn append_decorative_layers(
    chain: &mut String,
    last: &mut String,
    layers: &[DecorativeLayerSpec],
) -> (Vec<PathBuf>, u32) {
    let mut image_paths = Vec::new();
    let mut img_input = 0u32;
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
            DecorativeLayerSpec::Image {
                path,
                rect,
                object_fit,
                opacity,
            } => {
                step += 1;
                let input_idx = 2 + img_input;
                img_input += 1;
                image_paths.push(path.clone());
                let scale = cover_scale_filter(object_fit, rect.width, rect.height);
                let img_l = format!("vimg{step}");
                let next = format!("vov{step}");
                let alpha = opacity.clamp(0.05, 1.0);
                chain.push_str(&format!(
                    ";[{input_idx}:v]{scale},format=rgba,colorchannelmixer=aa={alpha:.3}[{img_l}];\
                     [{last}][{img_l}]overlay={}:{}:format=auto,format=yuv420p[{next}]",
                    rect.x, rect.y
                ));
                *last = next;
            }
        }
    }

    (image_paths, img_input)
}

fn build_render_filter(
    w: u32,
    h: u32,
    ass: Option<&Path>,
    opts: &ShareVideoExportOptions,
) -> (String, String, Vec<PathBuf>) {
    let bg = opts.bg_color.as_str();
    let mut chain = build_cover_base(w, h, bg, opts.cover_rect.as_ref(), &opts.cover_object_fit);
    let mut last = "v0".to_string();

    let (extra_images, _) = append_decorative_layers(&mut chain, &mut last, &opts.decorative_layers);

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

    (chain, last, extra_images)
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

fn emit_progress(opts: &ShareVideoExportOptions, phase: &str, percent: f32, message: &str) {
    if let (Some(id), Some(cb)) = (opts.export_id.as_deref(), opts.progress.as_ref()) {
        cb(Mp4ExportProgress {
            id: id.to_string(),
            phase: phase.to_string(),
            percent,
            message: message.to_string(),
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
    write_karaoke_ass_styled(
        &words,
        &ass_path,
        opts.height,
        opts.width,
        font_size,
        margin_v,
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
) -> Result<()> {
    let logo_px = 56u32;
    let filter = format!(
        "{base_filter};\
         [2:v]scale={logo_px}:{logo_px}:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=0.42[wm];\
         [{out_label}][wm]overlay={}:24:format=auto,format=yuv420p[vfinal]",
        w.saturating_sub(logo_px + 20)
    );

    emit_progress(opts, "render", 0.08, "Renderuję wideo…");
    let child = Command::new("ffmpeg")
        .arg("-y")
        .arg("-loglevel")
        .arg("info")
        .arg("-loop")
        .arg("1")
        .arg("-i")
        .arg(cover)
        .arg("-i")
        .arg(audio)
        .arg("-i")
        .arg(logo)
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[vfinal]")
        .arg("-map")
        .arg("1:a")
        .arg("-c:v")
        .arg("libx264")
        .arg("-tune")
        .arg("stillimage")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("128k")
        .arg("-shortest")
        .arg(dest)
        .stderr(Stdio::piped())
        .spawn()
        .context("spawn ffmpeg for mp4 export with logo")?;

    wait_ffmpeg_with_progress(child, probe_audio_duration_ms(audio).unwrap_or(0), opts)
}

fn run_ffmpeg_render(
    audio: &Path,
    cover: &Path,
    dest: &Path,
    filter: &str,
    out_label: &str,
    extra_images: &[PathBuf],
    opts: &ShareVideoExportOptions,
) -> Result<()> {
    emit_progress(opts, "render", 0.08, "Renderuję wideo…");
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-loglevel")
        .arg("info")
        .arg("-loop")
        .arg("1")
        .arg("-i")
        .arg(cover)
        .arg("-i")
        .arg(audio);
    for img in extra_images {
        cmd.arg("-loop").arg("1").arg("-i").arg(img);
    }
    let child = cmd
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg(format!("[{out_label}]"))
        .arg("-map")
        .arg("1:a")
        .arg("-c:v")
        .arg("libx264")
        .arg("-tune")
        .arg("stillimage")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("128k")
        .arg("-shortest")
        .arg(dest)
        .stderr(Stdio::piped())
        .spawn()
        .context("spawn ffmpeg for mp4 export")?;

    wait_ffmpeg_with_progress(child, probe_audio_duration_ms(audio).unwrap_or(0), opts)
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

    if let (Some(stderr), Some(cb)) = (stderr, progress_cb) {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if let Some(secs) = parse_ffmpeg_time_seconds(&line) {
                    let pct = (secs / duration_s).clamp(0.08, 0.95);
                    if let Some(id) = export_id.as_deref() {
                        cb(Mp4ExportProgress {
                            id: id.to_string(),
                            phase: "render".to_string(),
                            percent: pct,
                            message: "Renderuję wideo…".to_string(),
                        });
                    }
                }
            }
        });
    }

    let status = child.wait().context("wait ffmpeg")?;
    if !status.success() {
        return Err(anyhow!("ffmpeg mp4 export failed (exit {status})"));
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
}
