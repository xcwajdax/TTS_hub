use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

use crate::audio::ensure_ffmpeg;
use crate::minimax_subtitles::{
    estimate_word_timings_from_text, expand_sentences_to_words, parse_minimax_subtitles_with_duration,
    write_karaoke_ass, TimedWord,
};

/// Square 720×720 — good WhatsApp chat preview; small file size.
pub const WHATSAPP_VIDEO_SIZE: u32 = 720;

const COVER_MAX_KARAOKE: u32 = 380;
const COVER_MAX_STATIC: u32 = 480;
const FOOTER_PAD: u32 = 18;
const BG_COLOR: &str = "0x12141a";

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
    let karaoke = prepare_karaoke_ass(opts, dest, audio_duration_ms)?;
    emit_progress(opts, "render", 0.05, "Przygotowuję napisy…");
    let cover_max = if karaoke.is_some() {
        COVER_MAX_KARAOKE.min(w.saturating_sub(80)).min(h.saturating_sub(220))
    } else {
        COVER_MAX_STATIC.min(w.saturating_sub(80)).min(h.saturating_sub(160))
    };
    let y_offset = if karaoke.is_some() {
        -72
    } else if opts.title_lines.is_empty() {
        0
    } else {
        -48
    };

    let (filter, out_label) = build_render_filter(
        w,
        h,
        cover_max,
        y_offset,
        karaoke.as_deref(),
        opts,
    );

    if let Some(logo) = opts.watermark_logo.as_ref().filter(|p| p.is_file()) {
        return export_with_logo_overlay(audio, cover, dest, &filter, &out_label, logo, w, opts);
    }

    run_ffmpeg_render(audio, cover, dest, &filter, &out_label, opts)
}

fn build_render_filter(
    w: u32,
    h: u32,
    cover_max: u32,
    y_offset: i32,
    ass: Option<&Path>,
    opts: &ShareVideoExportOptions,
) -> (String, String) {
    let mut chain = format!(
        "[0:v]scale={cover_max}:{cover_max}:force_original_aspect_ratio=decrease,\
         pad={w}:{h}:(ow-iw)/2:(oh-ih)/2+{y_offset}:color={BG_COLOR},format=yuv420p[v0]"
    );
    let mut last = "v0".to_string();

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
                footer_drawtext_filter(footer, h, &font)
            ));
            last = "vfoot".to_string();
        }
        chain.push_str(&format!(
            ";[{last}]{}[vout]",
            watermark_drawtext_filter(&opts.watermark_text, w, &font)
        ));
        last = "vout".to_string();
    }

    (chain, last)
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

fn footer_drawtext_filter(footer: &str, h: u32, font: &str) -> String {
    let escaped = escape_drawtext(footer);
    let y = h.saturating_sub(FOOTER_PAD);
    format!(
        "drawtext=fontfile='{font}':text='{escaped}':\
         fontsize=18:fontcolor=0xA8B0C0@0.92:\
         x=(w-text_w)/2:y={y}"
    )
}

fn watermark_drawtext_filter(watermark: &str, w: u32, font: &str) -> String {
    if watermark.trim().is_empty() {
        return "null".to_string();
    }
    let escaped = escape_drawtext(watermark);
    let x = w.saturating_sub(24);
    format!(
        "drawtext=fontfile='{font}':text='{escaped}':\
         fontsize=22:fontcolor=0xFFFFFF@0.38:\
         x={x}-text_w:y=24"
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
    let words = match resolve_karaoke_words(opts, audio_duration_ms) {
        Some(w) if !w.is_empty() => w,
        _ => return Ok(None),
    };
    let ass_path = dest.with_extension("ass");
    write_karaoke_ass(&words, &ass_path, opts.height)?;
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
    opts: &ShareVideoExportOptions,
) -> Result<()> {
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
