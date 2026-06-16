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
    let font = subtitle_font_name();
    let margin_v = margin_v.min(video_height.saturating_sub(80));
    let lines = group_words_into_lines(words, 34, 8);
    let mut events = String::new();

    for line in lines {
        if line.is_empty() {
            continue;
        }
        let start = ms_to_ass_time(line[0].start_ms);
        let end = ms_to_ass_time(line.last().map(|w| w.end_ms).unwrap_or(line[0].end_ms));
        let mut karaoke = String::new();
        for word in &line {
            let dur_cs = ((word.end_ms.saturating_sub(word.start_ms)).max(40) / 10) as i64;
            karaoke.push_str(&format!("{{\\kf{dur_cs}}}{} ", ass_escape(&word.text)));
        }
        events.push_str(&format!(
            "Dialogue: 0,{start},{end},Karaoke,,0,0,0,,{karaoke}\n"
        ));
    }

    let script = format!(
        "[Script Info]\n\
         ScriptType: v4.00+\n\
         PlayResX: {play_res_x}\n\
         PlayResY: {video_height}\n\
         WrapStyle: 0\n\
         ScaledBorderAndShadow: yes\n\
         \n\
         [V4+ Styles]\n\
         Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n\
         Style: Karaoke,{font},{font_size},&H00A8B0C0,&H0000D7FF,&H101010,&H96000000,0,0,0,0,100,100,0,0,1,3,1,2,40,40,{margin_v},1\n\
         \n\
         [Events]\n\
         Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n\
         {events}"
    );

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).context("create ass dir")?;
    }
    std::fs::write(dest, script).context("write ass subtitles")?;
    Ok(())
}

fn group_words_into_lines(words: &[TimedWord], max_chars: usize, max_words: usize) -> Vec<Vec<TimedWord>> {
    let mut lines: Vec<Vec<TimedWord>> = Vec::new();
    let mut current: Vec<TimedWord> = Vec::new();
    let mut char_count = 0usize;

    for word in words {
        let add = word.text.len() + if current.is_empty() { 0 } else { 1 };
        if !current.is_empty()
            && (char_count + add > max_chars || current.len() >= max_words)
        {
            lines.push(current);
            current = Vec::new();
            char_count = 0;
        }
        char_count += word.text.len() + if current.is_empty() { 0 } else { 1 };
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
}
