use std::path::Path;

use anyhow::{anyhow, Context, Result};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimedWord {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
}

/// Parse MiniMax `subtitle_file` JSON (ms timestamps, sentence or word granularity).
pub fn parse_minimax_subtitles(bytes: &[u8]) -> Result<Vec<TimedWord>> {
    parse_minimax_subtitles_with_duration(bytes, None)
}

pub fn parse_minimax_subtitles_with_duration(
    bytes: &[u8],
    audio_duration_ms: Option<u64>,
) -> Result<Vec<TimedWord>> {
    let root: Value = serde_json::from_slice(bytes).context("parse subtitle json")?;
    let mut words = Vec::new();
    collect_words_from_value(&root, &mut words);
    if words.is_empty() {
        return Err(anyhow!("subtitle json contained no timed words"));
    }
    words.sort_by_key(|w| w.start_ms);
    if let Some(dur) = audio_duration_ms {
        normalize_timestamp_units(&mut words, dur);
    }
    normalize_word_timings(&mut words);
    Ok(words)
}

/// MiniMax may return seconds (floats) or milliseconds — align to audio length.
pub fn normalize_timestamp_units(words: &mut [TimedWord], audio_duration_ms: u64) {
    if words.is_empty() || audio_duration_ms < 200 {
        return;
    }
    let max_end = words.iter().map(|w| w.end_ms).max().unwrap_or(0);
    if max_end == 0 {
        return;
    }
    // Values like 0–12 with 8s audio → seconds stored as integers.
    if max_end < audio_duration_ms / 4 && max_end <= 600 {
        let scaled_max = max_end.saturating_mul(1000);
        if scaled_max <= audio_duration_ms.saturating_add(audio_duration_ms / 2) {
            for w in words.iter_mut() {
                w.start_ms = w.start_ms.saturating_mul(1000);
                w.end_ms = w.end_ms.saturating_mul(1000);
            }
        }
    }
}

fn collect_words_from_value(value: &Value, out: &mut Vec<TimedWord>) {
    match value {
        Value::Array(items) => {
            for item in items {
                push_segment_words(item, out);
            }
        }
        Value::Object(map) => {
            for key in [
                "words",
                "word_list",
                "timestamped_words",
                "subtitles",
                "sentences",
                "sentence_list",
                "items",
                "data",
                "segments",
                "subtitle",
                "result",
            ] {
                if let Some(arr) = map.get(key).and_then(|v| v.as_array()) {
                    for item in arr {
                        push_segment_words(item, out);
                    }
                    if !out.is_empty() {
                        return;
                    }
                }
            }
            // Some API responses wrap JSON as a string.
            for key in ["subtitle", "data", "content"] {
                if let Some(s) = map.get(key).and_then(|v| v.as_str()) {
                    if let Ok(inner) = serde_json::from_str::<Value>(s) {
                        collect_words_from_value(&inner, out);
                        if !out.is_empty() {
                            return;
                        }
                    }
                }
            }
            push_segment_words(value, out);
        }
        _ => {}
    }
}

fn push_segment_words(segment: &Value, out: &mut Vec<TimedWord>) {
    if let Some(nested) = segment
        .get("words")
        .or_else(|| segment.get("word_list"))
        .or_else(|| segment.get("timestamped_words"))
        .and_then(|v| v.as_array())
    {
        for word in nested {
            if let Some(tw) = word_from_object(word) {
                out.push(tw);
            }
        }
        return;
    }

    if let Some(text) = text_field(segment) {
        if let Some((start, end)) = timing_pair(segment) {
            out.push(TimedWord {
                text,
                start_ms: start,
                end_ms: end.max(start + 1),
            });
        }
    }
}

fn word_from_object(obj: &Value) -> Option<TimedWord> {
    let text = text_field(obj)?;
    let (start, end) = timing_pair(obj)?;
    Some(TimedWord {
        text,
        start_ms: start,
        end_ms: end.max(start + 1),
    })
}

fn text_field(obj: &Value) -> Option<String> {
    for key in ["word", "text", "content", "token", "value"] {
        if let Some(s) = obj.get(key).and_then(|v| v.as_str()) {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn timing_pair(obj: &Value) -> Option<(u64, u64)> {
    let start = read_time_ms(
        obj,
        &[
            "time_begin",
            "timeBegin",
            "timestamp_begin",
            "timestampBegin",
            "start_time",
            "startTime",
            "start_ms",
            "startMs",
            "begin_time",
            "beginTime",
            "begin",
            "start",
            "from",
        ],
    )?;
    let end = read_time_ms(
        obj,
        &[
            "time_end",
            "timeEnd",
            "timestamp_end",
            "timestampEnd",
            "end_time",
            "endTime",
            "end_ms",
            "endMs",
            "finish_time",
            "finishTime",
            "end",
            "to",
        ],
    )
    .unwrap_or(start);
    Some((start, end))
}

fn read_time_ms(obj: &Value, keys: &[&str]) -> Option<u64> {
    for key in keys {
        if let Some(v) = obj.get(*key) {
            if let Some(ms) = value_to_ms(v) {
                return Some(ms);
            }
        }
    }
    None
}

fn value_to_ms(v: &Value) -> Option<u64> {
    match v {
        Value::Number(n) => {
            let raw = n.as_f64()?;
            if raw < 0.0 {
                return None;
            }
            // MiniMax docs say ms; floats are usually seconds.
            if n.is_f64() && raw.fract() != 0.0 && raw < 3600.0 {
                return Some((raw * 1000.0).round() as u64);
            }
            Some(raw.round() as u64)
        }
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return None;
            }
            if trimmed.contains(':') {
                parse_clock_ms(trimmed)
            } else if let Ok(v) = trimmed.parse::<f64>() {
                value_to_ms(&Value::from(v))
            } else {
                None
            }
        }
        _ => None,
    }
}

fn parse_clock_ms(clock: &str) -> Option<u64> {
    let parts: Vec<&str> = clock.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: u64 = parts[0].parse().ok()?;
    let minutes: u64 = parts[1].parse().ok()?;
    let seconds: f64 = parts[2].replace(',', ".").parse().ok()?;
    Some(hours * 3_600_000 + minutes * 60_000 + (seconds * 1000.0).round() as u64)
}

fn normalize_word_timings(words: &mut [TimedWord]) {
    for w in words.iter_mut() {
        if w.end_ms <= w.start_ms {
            w.end_ms = w.start_ms + 80;
        }
    }
}

/// Expand sentence-level cues into per-word timings for visible karaoke.
pub fn expand_sentences_to_words(words: Vec<TimedWord>) -> Vec<TimedWord> {
    let mut out = Vec::new();
    for word in words {
        let parts: Vec<&str> = word.text.split_whitespace().collect();
        if parts.len() <= 1 {
            out.push(word);
            continue;
        }
        let total_chars: usize = parts.iter().map(|p| p.len()).sum::<usize>().max(1);
        let duration = word.end_ms.saturating_sub(word.start_ms).max(parts.len() as u64 * 40);
        let mut cursor = word.start_ms;
        for (i, part) in parts.iter().enumerate() {
            let share = part.len();
            let word_dur = if i + 1 == parts.len() {
                word.end_ms.saturating_sub(cursor)
            } else {
                (duration * share as u64) / total_chars as u64
            }
            .max(40);
            out.push(TimedWord {
                text: (*part).to_string(),
                start_ms: cursor,
                end_ms: cursor + word_dur,
            });
            cursor += word_dur;
        }
    }
    out
}

/// Evenly distribute words across audio duration when MiniMax subtitles are missing.
pub fn estimate_word_timings_from_text(text: &str, duration_ms: u64) -> Vec<TimedWord> {
    let parts: Vec<String> = text
        .split_whitespace()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();
    if parts.is_empty() || duration_ms == 0 {
        return Vec::new();
    }
    let total_chars: usize = parts.iter().map(|p| p.len()).sum::<usize>().max(1);
    let mut cursor = 0u64;
    let mut out = Vec::with_capacity(parts.len());
    for (i, part) in parts.iter().enumerate() {
        let share = part.len();
        let word_dur = if i + 1 == parts.len() {
            duration_ms.saturating_sub(cursor)
        } else {
            (duration_ms * share as u64) / total_chars as u64
        }
        .max(60);
        out.push(TimedWord {
            text: part.clone(),
            start_ms: cursor,
            end_ms: cursor + word_dur,
        });
        cursor += word_dur;
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KaraokeScrollMode {
    /// One line at a time, word fill (`\\kf`) — original WhatsApp karaoke.
    Classic,
    /// Active line in the center; neighbors faded; discrete scroll by one line.
    LineFocus,
    /// Tight wrapped block, justified gaps, continuous upward scroll.
    Smooth,
}

impl KaraokeScrollMode {
    pub fn parse(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "line-focus" | "line_focus" | "line" => Self::LineFocus,
            "smooth" | "smooth-justify" | "justify" => Self::Smooth,
            _ => Self::Classic,
        }
    }
}

/// Layout for karaoke ASS (clip rect is PlayRes pixels).
#[derive(Debug, Clone)]
pub struct KaraokeAssLayout {
    pub play_res_x: u32,
    pub play_res_y: u32,
    pub font_size: u32,
    pub margin_v: u32,
    pub clip: Option<(u32, u32, u32, u32)>,
    pub scroll_mode: KaraokeScrollMode,
    pub audio_end_ms: Option<u64>,
}

impl KaraokeAssLayout {
    pub fn classic(play_res_x: u32, play_res_y: u32, font_size: u32, margin_v: u32) -> Self {
        Self {
            play_res_x,
            play_res_y,
            font_size,
            margin_v,
            clip: None,
            scroll_mode: KaraokeScrollMode::Classic,
            audio_end_ms: None,
        }
    }
}

/// Build karaoke ASS — full line with gold fill per word (`\kf`), below the cover art.
pub fn write_karaoke_ass(words: &[TimedWord], dest: &Path, video_height: u32) -> Result<()> {
    write_karaoke_ass_styled(
        words,
        dest,
        video_height,
        720,
        40,
        62u32.min(video_height.saturating_sub(120)),
    )
}

pub fn write_karaoke_ass_styled(
    words: &[TimedWord],
    dest: &Path,
    video_height: u32,
    play_res_x: u32,
    font_size: u32,
    margin_v: u32,
) -> Result<()> {
    write_karaoke_ass_with_layout(
        words,
        dest,
        &KaraokeAssLayout::classic(play_res_x, video_height, font_size, margin_v),
    )
}

pub fn write_karaoke_ass_with_layout(
    words: &[TimedWord],
    dest: &Path,
    layout: &KaraokeAssLayout,
) -> Result<()> {
    let font = subtitle_font_name();
    let font_size = layout.font_size.max(12);
    let margin_v = layout.margin_v.min(layout.play_res_y.saturating_sub(80));
    let alignment = match layout.scroll_mode {
        KaraokeScrollMode::Classic => 2,
        _ => 5,
    };
    let events = match layout.scroll_mode {
        KaraokeScrollMode::Classic => classic_events(words),
        KaraokeScrollMode::LineFocus => line_focus_events(words, layout),
        KaraokeScrollMode::Smooth => smooth_events(words, layout),
    };

    let script = format!(
        "[Script Info]\n\
         ScriptType: v4.00+\n\
         PlayResX: {}\n\
         PlayResY: {}\n\
         WrapStyle: 0\n\
         ScaledBorderAndShadow: yes\n\
         \n\
         [V4+ Styles]\n\
         Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n\
         Style: Karaoke,{font},{font_size},&H00A8B0C0,&H0000D7FF,&H101010,&H96000000,0,0,0,0,100,100,0,0,1,3,1,{alignment},40,40,{margin_v},1\n\
         \n\
         [Events]\n\
         Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n\
         {events}",
        layout.play_res_x, layout.play_res_y,
    );

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).context("create ass dir")?;
    }
    std::fs::write(dest, script).context("write ass subtitles")?;
    Ok(())
}

fn classic_events(words: &[TimedWord]) -> String {
    let lines = group_words_into_lines(words, 34, 8);
    let mut events = String::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let (start_ms, end_ms) = line_span(&line);
        events.push_str(&format!(
            "Dialogue: 0,{},{},Karaoke,,0,0,0,,{}\n",
            ms_to_ass_time(start_ms),
            ms_to_ass_time(end_ms.max(start_ms + 40)),
            karaoke_fill_text(&line, false, 0),
        ));
    }
    events
}

fn line_focus_events(words: &[TimedWord], layout: &KaraokeAssLayout) -> String {
    let (clip_x, clip_y, clip_w, clip_h) = layout.clip.unwrap_or((
        40,
        layout.play_res_y.saturating_sub(200),
        layout.play_res_x.saturating_sub(80),
        200,
    ));
    let max_chars = max_chars_for_width(clip_w, layout.font_size);
    let lines = group_words_into_lines(words, max_chars, 10);
    if lines.is_empty() {
        return String::new();
    }

    let fs = layout.font_size.max(12);
    let line_h = ((fs as f32) * 1.55).round().max(fs as f32 + 8.0);
    let radius = visible_radius(clip_h, line_h);
    let cx = clip_x + clip_w / 2;
    let center_y = clip_y + clip_h / 2;
    let clip = clip_tag(clip_x, clip_y, clip_w, clip_h);
    let mut events = String::new();

    for (i, line) in lines.iter().enumerate() {
        if line.is_empty() {
            continue;
        }
        let start_ms = line[0].start_ms;
        let end_ms = lines
            .get(i + 1)
            .and_then(|next| next.first())
            .map(|w| w.start_ms)
            .unwrap_or_else(|| line_span(line).1);
        let end_ms = end_ms
            .max(start_ms + 80)
            .min(layout.audio_end_ms.unwrap_or(u64::MAX).max(start_ms + 80));
        let hold = end_ms.saturating_sub(start_ms);
        let move_ms = if i == 0 { 0 } else { 220u64.min(hold / 4).max(80) };

        for d in -(radius as i32)..=(radius as i32) {
            let idx = i as i32 + d;
            if idx < 0 || idx as usize >= lines.len() {
                continue;
            }
            let neighbor = &lines[idx as usize];
            let y_to = (center_y as f32 + d as f32 * line_h).round() as i32;
            let y_from = if move_ms == 0 {
                y_to
            } else {
                (center_y as f32 + (d + 1) as f32 * line_h).round() as i32
            };
            let dist = d.unsigned_abs();
            let is_active = d == 0;
            let alpha = match dist {
                0 => "00",
                1 => "70",
                _ => "B4",
            };
            let neighbor_fs = if is_active {
                fs
            } else {
                ((fs as f32) * 0.84).round() as u32
            };
            let pos = if move_ms == 0 || y_from == y_to {
                format!("\\pos({cx},{y_to})")
            } else {
                format!("\\move({cx},{y_from},{cx},{y_to},0,{move_ms})")
            };
            let bold = if is_active { "\\b1" } else { "\\b0" };
            let color = if is_active {
                "\\c&H00FFFFFF&"
            } else {
                "\\c&H00C0C8D0&"
            };
            let text = if is_active {
                karaoke_fill_text(neighbor, false, 0)
            } else {
                plain_line_text(neighbor, false, 0)
            };
            let layer = if is_active { 2 } else { 0 };
            events.push_str(&format!(
                "Dialogue: {layer},{},{},Karaoke,,0,0,0,,{{{pos}{clip}\\an5\\fs{neighbor_fs}{bold}{color}\\alpha&H{alpha}&}}{text}\n",
                ms_to_ass_time(start_ms),
                ms_to_ass_time(end_ms),
            ));
        }
    }
    events
}

fn smooth_events(words: &[TimedWord], layout: &KaraokeAssLayout) -> String {
    let (clip_x, clip_y, clip_w, clip_h) = layout.clip.unwrap_or((
        40,
        layout.play_res_y.saturating_sub(220),
        layout.play_res_x.saturating_sub(80),
        220,
    ));
    let max_chars = max_chars_for_width(clip_w, layout.font_size);
    let lines = group_words_into_lines(words, max_chars, 14);
    if lines.is_empty() {
        return String::new();
    }

    let fs = layout.font_size.max(12);
    let line_h = ((fs as f32) * 1.18).round().max(fs as f32 + 2.0);
    let n = lines.len() as f32;
    let content_h = n * line_h;
    let view_h = clip_h as f32;
    let scroll = if content_h > view_h {
        content_h - view_h + line_h
    } else {
        0.0
    };
    let y0 = if scroll <= 0.0 {
        clip_y as f32 + (view_h - content_h).max(0.0) / 2.0
    } else {
        clip_y as f32 + 4.0
    };
    let duration_ms = layout
        .audio_end_ms
        .or_else(|| lines.last().and_then(|l| l.last().map(|w| w.end_ms)))
        .unwrap_or(1000)
        .max(200);
    let cx = clip_x + clip_w / 2;
    let clip = clip_tag(clip_x, clip_y, clip_w, clip_h);
    let mut events = String::new();

    for (i, line) in lines.iter().enumerate() {
        if line.is_empty() {
            continue;
        }
        let is_last = i + 1 == lines.len();
        let y_start = y0 + i as f32 * line_h + line_h / 2.0;
        let y_end = y_start - scroll;
        let y1 = y_start.round() as i32;
        let y2 = y_end.round() as i32;
        let dim_text = plain_line_text(line, !is_last, max_chars).trim_end().to_string();
        let move_full = if scroll <= 0.5 {
            format!("\\pos({cx},{y1})")
        } else {
            format!("\\move({cx},{y1},{cx},{y2})")
        };
        events.push_str(&format!(
            "Dialogue: 0,{},{},Karaoke,,0,0,0,,{{{move_full}{clip}\\an5\\fs{fs}\\c&H00B0B8C4&\\alpha&H78&}}{}\n",
            ms_to_ass_time(0),
            ms_to_ass_time(duration_ms),
            dim_text,
        ));

        let (line_start, line_end) = line_span(line);
        let line_end = line_end.max(line_start + 40).min(duration_ms);
        let p0 = (line_start as f32) / (duration_ms as f32);
        let p1 = (line_end as f32) / (duration_ms as f32);
        let hy1 = (y_start - scroll * p0).round() as i32;
        let hy2 = (y_start - scroll * p1).round() as i32;
        let highlight_move = if (hy1 - hy2).abs() < 1 {
            format!("\\pos({cx},{hy1})")
        } else {
            format!("\\move({cx},{hy1},{cx},{hy2})")
        };
        let karaoke = karaoke_fill_text(line, !is_last, max_chars);
        events.push_str(&format!(
            "Dialogue: 1,{},{},Karaoke,,0,0,0,,{{{highlight_move}{clip}\\an5\\fs{fs}\\b1\\c&H00FFFFFF&\\alpha&H00&}}{karaoke}\n",
            ms_to_ass_time(line_start),
            ms_to_ass_time(line_end),
        ));
    }
    events
}

fn visible_radius(clip_h: u32, line_h: f32) -> u32 {
    if line_h <= 1.0 {
        return 1;
    }
    let fit = (clip_h as f32 / line_h).floor() as i32;
    if fit >= 5 {
        2
    } else if fit >= 3 {
        1
    } else {
        0
    }
}

fn max_chars_for_width(width: u32, font_size: u32) -> usize {
    let char_w = (font_size as f32 * 0.52).max(7.0);
    let usable = width.saturating_sub(28) as f32;
    ((usable / char_w) as usize).clamp(12, 72)
}

fn clip_tag(x: u32, y: u32, w: u32, h: u32) -> String {
    format!("\\clip({},{},{},{})", x, y, x.saturating_add(w), y.saturating_add(h))
}

fn line_span(line: &[TimedWord]) -> (u64, u64) {
    let start = line.first().map(|w| w.start_ms).unwrap_or(0);
    let end = line.last().map(|w| w.end_ms).unwrap_or(start);
    (start, end.max(start + 40))
}

fn karaoke_fill_text(line: &[TimedWord], justify: bool, target_chars: usize) -> String {
    let gaps = justify_gap_spaces(line, justify, target_chars);
    let mut out = String::new();
    for (i, word) in line.iter().enumerate() {
        let dur_cs = ((word.end_ms.saturating_sub(word.start_ms)).max(40) / 10) as i64;
        out.push_str(&format!("{{\\kf{dur_cs}}}{}", ass_escape(&word.text)));
        if i + 1 < line.len() {
            let spaces = gaps.get(i).copied().unwrap_or(1).max(1);
            out.push_str(&" ".repeat(spaces));
        }
    }
    out
}

fn plain_line_text(line: &[TimedWord], justify: bool, target_chars: usize) -> String {
    let gaps = justify_gap_spaces(line, justify, target_chars);
    let mut out = String::new();
    for (i, word) in line.iter().enumerate() {
        out.push_str(&ass_escape(&word.text));
        if i + 1 < line.len() {
            let spaces = gaps.get(i).copied().unwrap_or(1).max(1);
            out.push_str(&" ".repeat(spaces));
        }
    }
    out
}

fn justify_gap_spaces(line: &[TimedWord], justify: bool, target_chars: usize) -> Vec<usize> {
    if line.len() <= 1 {
        return Vec::new();
    }
    let n_gaps = line.len() - 1;
    let mut gaps = vec![1usize; n_gaps];
    if !justify || target_chars == 0 {
        return gaps;
    }
    let content: usize = line.iter().map(|w| w.text.chars().count()).sum();
    let min_len = content + n_gaps;
    if target_chars <= min_len {
        return gaps;
    }
    let extra = target_chars - min_len;
    let base = extra / n_gaps;
    let rem = extra % n_gaps;
    for (i, gap) in gaps.iter_mut().enumerate() {
        *gap = 1 + base + usize::from(i < rem);
    }
    gaps
}

fn group_words_into_lines(words: &[TimedWord], max_chars: usize, max_words: usize) -> Vec<Vec<TimedWord>> {
    let mut lines: Vec<Vec<TimedWord>> = Vec::new();
    let mut current: Vec<TimedWord> = Vec::new();
    let mut char_count = 0usize;

    for word in words {
        if word.text.trim().is_empty() {
            continue;
        }
        let add = word.text.chars().count() + usize::from(!current.is_empty());
        if !current.is_empty() && (char_count + add > max_chars || current.len() >= max_words) {
            lines.push(current);
            current = Vec::new();
            char_count = 0;
        }
        char_count += word.text.chars().count() + usize::from(!current.is_empty());
        current.push(word.clone());
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

fn ms_to_ass_time(ms: u64) -> String {
    let cs = ms / 10;
    let s = cs / 100;
    let minutes = s / 60;
    let hours = minutes / 60;
    format!(
        "{}:{:02}:{:02}.{:02}",
        hours,
        minutes % 60,
        s % 60,
        cs % 100
    )
}

fn ass_escape(input: &str) -> String {
    input.replace('\\', "\\\\").replace('{', "\\{").replace('}', "\\}")
}

fn subtitle_font_name() -> &'static str {
    #[cfg(windows)]
    {
        "Segoe UI Semibold"
    }
    #[cfg(target_os = "macos")]
    {
        "SF Pro Display Semibold"
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "DejaVu Sans"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_word_level_payload() {
        let json = r#"[
            {
                "text": "Hello world",
                "time_begin": 0,
                "time_end": 1200,
                "words": [
                    {"word": "Hello", "time_begin": 0, "time_end": 520},
                    {"word": "world", "time_begin": 520, "time_end": 1200}
                ]
            }
        ]"#;
        let words = parse_minimax_subtitles(json.as_bytes()).unwrap();
        assert_eq!(words.len(), 2);
        assert_eq!(words[0].text, "Hello");
        assert_eq!(words[1].start_ms, 520);
    }

    #[test]
    fn parses_sentence_level_payload() {
        let json = r#"[
            {"text": "Pierwsze zdanie.", "time_begin": 0, "time_end": 1800},
            {"text": "Drugie zdanie.", "time_begin": 1800, "time_end": 3400}
        ]"#;
        let words = parse_minimax_subtitles(json.as_bytes()).unwrap();
        assert_eq!(words.len(), 2);
        assert_eq!(words[1].text, "Drugie zdanie.");
    }

    #[test]
    fn writes_ass_file() {
        let words = vec![
            TimedWord {
                text: "Cześć".into(),
                start_ms: 0,
                end_ms: 400,
            },
            TimedWord {
                text: "świecie".into(),
                start_ms: 400,
                end_ms: 900,
            },
        ];
        let dir = std::env::temp_dir().join(format!("tts_hub_ass_test_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("test.ass");
        write_karaoke_ass(&words, &path, 720).unwrap();
        let body = std::fs::read_to_string(&path).unwrap();
        assert!(body.contains("Dialogue:"));
        assert!(body.contains("\\kf"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn normalizes_second_timestamps() {
        let json = r#"[{"text": "Hello", "time_begin": 0, "time_end": 2}]"#;
        let words = parse_minimax_subtitles_with_duration(json.as_bytes(), Some(2500)).unwrap();
        assert_eq!(words[0].end_ms, 2000);
    }

    fn sample_words() -> Vec<TimedWord> {
        (0..12)
            .map(|i| TimedWord {
                text: format!("słowo{i}"),
                start_ms: i * 400,
                end_ms: i * 400 + 380,
            })
            .collect()
    }

    #[test]
    fn writes_line_focus_ass_with_clip_and_move() {
        let dir = std::env::temp_dir().join(format!("tts_hub_ass_focus_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("focus.ass");
        let layout = KaraokeAssLayout {
            play_res_x: 720,
            play_res_y: 1280,
            font_size: 42,
            margin_v: 80,
            clip: Some((40, 900, 640, 280)),
            scroll_mode: KaraokeScrollMode::LineFocus,
            audio_end_ms: Some(5000),
        };
        write_karaoke_ass_with_layout(&sample_words(), &path, &layout).unwrap();
        let body = std::fs::read_to_string(&path).unwrap();
        assert!(body.contains("\\clip("), "{body}");
        assert!(body.contains("\\an5"), "{body}");
        assert!(body.contains("\\kf"), "{body}");
        assert!(body.contains("Dialogue: 2,"), "{body}");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn writes_smooth_ass_with_move_and_justify() {
        let dir = std::env::temp_dir().join(format!("tts_hub_ass_smooth_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("smooth.ass");
        let layout = KaraokeAssLayout {
            play_res_x: 720,
            play_res_y: 1280,
            font_size: 36,
            margin_v: 80,
            clip: Some((40, 880, 640, 320)),
            scroll_mode: KaraokeScrollMode::Smooth,
            audio_end_ms: Some(5000),
        };
        write_karaoke_ass_with_layout(&sample_words(), &path, &layout).unwrap();
        let body = std::fs::read_to_string(&path).unwrap();
        assert!(body.contains("\\move(") || body.contains("\\pos("), "{body}");
        assert!(body.contains("\\clip("), "{body}");
        assert!(body.contains("\\kf"), "{body}");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn justify_spreads_extra_spaces() {
        let line = vec![
            TimedWord {
                text: "Ala".into(),
                start_ms: 0,
                end_ms: 100,
            },
            TimedWord {
                text: "ma".into(),
                start_ms: 100,
                end_ms: 200,
            },
            TimedWord {
                text: "kota".into(),
                start_ms: 200,
                end_ms: 300,
            },
        ];
        let gaps = justify_gap_spaces(&line, true, 20);
        assert_eq!(gaps.len(), 2);
        assert_eq!(gaps.iter().sum::<usize>(), 20 - ("Ala".len() + "ma".len() + "kota".len()));
        let plain = plain_line_text(&line, true, 20);
        assert_eq!(plain.chars().count(), 20);
    }

    #[test]
    fn scroll_mode_parse() {
        assert_eq!(KaraokeScrollMode::parse("line-focus"), KaraokeScrollMode::LineFocus);
        assert_eq!(KaraokeScrollMode::parse("smooth"), KaraokeScrollMode::Smooth);
        assert_eq!(KaraokeScrollMode::parse(""), KaraokeScrollMode::Classic);
    }
}
