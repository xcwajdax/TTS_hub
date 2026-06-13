use regex::Regex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BuiltinFilterToggles {
    #[serde(default = "default_true")]
    pub strip_fenced_code: bool,
    #[serde(default = "default_true")]
    pub strip_inline_code: bool,
    #[serde(default)]
    pub strip_blockquotes: bool,
}

fn default_true() -> bool {
    true
}

impl Default for BuiltinFilterToggles {
    fn default() -> Self {
        Self {
            strip_fenced_code: true,
            strip_inline_code: true,
            strip_blockquotes: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTextFilter {
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub pattern: String,
    #[serde(default)]
    pub replacement: String,
    #[serde(default)]
    pub flags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextFilterPreset {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub builtins: BuiltinFilterToggles,
    #[serde(default)]
    pub custom: Vec<CustomTextFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextFiltersSettings {
    pub active_preset_id: Option<String>,
    #[serde(default = "default_presets")]
    pub presets: Vec<TextFilterPreset>,
}

fn default_presets() -> Vec<TextFilterPreset> {
    vec![default_preset()]
}

pub fn default_preset() -> TextFilterPreset {
    TextFilterPreset {
        id: Uuid::new_v4().to_string(),
        name: "Domyślny".to_string(),
        builtins: BuiltinFilterToggles::default(),
        custom: Vec::new(),
    }
}

impl Default for TextFiltersSettings {
    fn default() -> Self {
        let preset = default_preset();
        let id = preset.id.clone();
        Self {
            active_preset_id: Some(id),
            presets: vec![preset],
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ApplyFiltersResult {
    pub output: String,
    pub removed_chars: usize,
    pub warnings: Vec<String>,
}

pub fn apply_text_filters(input: &str, preset: &TextFilterPreset) -> ApplyFiltersResult {
    let original_len = input.chars().count();
    let mut out = input.to_string();
    let mut warnings = Vec::new();
    let builtins = &preset.builtins;

    if builtins.strip_fenced_code {
        if let Ok(re) = Regex::new(r"(?s)```.*?```") {
            out = re.replace_all(&out, " ").into_owned();
        }
    }
    if builtins.strip_inline_code {
        if let Ok(re) = Regex::new(r"`[^`]*`") {
            out = re.replace_all(&out, " ").into_owned();
        }
    }
    if builtins.strip_blockquotes {
        if let Ok(re) = Regex::new(r"(?m)^>\s?.*$") {
            out = re.replace_all(&out, " ").into_owned();
        }
    }

    for rule in &preset.custom {
        if !rule.enabled {
            continue;
        }
        let pat = rule.pattern.trim();
        if pat.is_empty() {
            continue;
        }
        let flags = sanitize_regex_flags(rule.flags.as_deref().unwrap_or(""));
        let full = if flags.is_empty() {
            pat.to_string()
        } else {
            format!("(?{flags}){pat}")
        };
        match Regex::new(&full) {
            Ok(re) => {
                out = re.replace_all(&out, rule.replacement.as_str()).into_owned();
            }
            Err(e) => warnings.push(format!("{}: {e}", rule.name)),
        }
    }

    out = normalize_whitespace(&out);
    let output_len = out.chars().count();
    let removed_chars = original_len.saturating_sub(output_len);

    ApplyFiltersResult {
        output: out,
        removed_chars,
        warnings,
    }
}

fn sanitize_regex_flags(flags: &str) -> String {
    let mut out = String::new();
    for ch in flags.chars() {
        if "imsuUx".contains(ch) && !out.contains(ch) {
            out.push(ch);
        }
    }
    out
}

fn normalize_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_space = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !prev_space && !out.is_empty() {
                out.push(' ');
                prev_space = true;
            }
        } else {
            out.push(ch);
            prev_space = false;
        }
    }
    out.trim().to_string()
}

impl TextFiltersSettings {
    pub fn normalize(&mut self) {
        if self.presets.is_empty() {
            let preset = default_preset();
            self.active_preset_id = Some(preset.id.clone());
            self.presets.push(preset);
        }
        for preset in &mut self.presets {
            if preset.id.trim().is_empty() {
                preset.id = Uuid::new_v4().to_string();
            }
            preset.name = preset.name.trim().to_string();
            if preset.name.is_empty() {
                preset.name = "Preset".to_string();
            }
            for rule in &mut preset.custom {
                if rule.id.trim().is_empty() {
                    rule.id = Uuid::new_v4().to_string();
                }
                rule.name = rule.name.trim().to_string();
                if rule.name.is_empty() {
                    rule.name = "Reguła".to_string();
                }
            }
        }
        if let Some(id) = &self.active_preset_id {
            if !self.presets.iter().any(|p| p.id == *id) {
                self.active_preset_id = self.presets.first().map(|p| p.id.clone());
            }
        } else {
            self.active_preset_id = self.presets.first().map(|p| p.id.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_fenced_code() {
        let preset = default_preset();
        let r = apply_text_filters("Hello ```rust\nfn main(){}\n``` world", &preset);
        assert!(!r.output.contains("fn main"));
        assert!(r.output.contains("Hello"));
        assert!(r.output.contains("world"));
    }
}
