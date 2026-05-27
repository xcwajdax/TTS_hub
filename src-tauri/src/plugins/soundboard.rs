use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::paths::AppPaths;
use crate::quick_hotkeys::{migrate_legacy_shortcut, normalize_shortcut_string};
use crate::state::AppState;

pub const SOUNDBOARD_SLOT_COUNT: usize = 8;

type AppArc = Arc<AppState>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SoundboardAudio {
    Empty,
    Generation {
        id: String,
    },
    File {
        stored_path: String,
    },
}

impl SoundboardAudio {
    pub fn is_empty(&self) -> bool {
        matches!(self, SoundboardAudio::Empty)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardSlot {
    pub label: String,
    pub enabled: bool,
    pub shortcut: String,
    pub audio: SoundboardAudio,
    #[serde(default)]
    pub shortcut_conflict: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_slots")]
    pub slots: Vec<SoundboardSlot>,
}

fn default_true() -> bool {
    true
}

fn default_shortcut_for_index(index: usize) -> String {
    format!("Ctrl+Shift+{}", index + 1)
}

fn default_slot(index: usize) -> SoundboardSlot {
    SoundboardSlot {
        label: format!("Slot {}", index + 1),
        enabled: true,
        shortcut: default_shortcut_for_index(index),
        audio: SoundboardAudio::Empty,
        shortcut_conflict: false,
    }
}

fn default_slots() -> Vec<SoundboardSlot> {
    (0..SOUNDBOARD_SLOT_COUNT)
        .map(default_slot)
        .collect()
}

impl Default for SoundboardSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            slots: default_slots(),
        }
    }
}

impl SoundboardSettings {
    pub fn normalize(&mut self) {
        if self.slots.len() < SOUNDBOARD_SLOT_COUNT {
            for i in self.slots.len()..SOUNDBOARD_SLOT_COUNT {
                self.slots.push(default_slot(i));
            }
        }
        if self.slots.len() > SOUNDBOARD_SLOT_COUNT {
            self.slots.truncate(SOUNDBOARD_SLOT_COUNT);
        }
        for (i, slot) in self.slots.iter_mut().enumerate() {
            slot.label = slot.label.trim().to_string();
            if slot.label.is_empty() {
                slot.label = format!("Slot {}", i + 1);
            }
            slot.shortcut = migrate_legacy_shortcut(&normalize_shortcut_string(&slot.shortcut));
            if slot.enabled && slot.shortcut.is_empty() {
                slot.enabled = false;
            }
        }
    }

    pub fn clear_conflict_flags(&mut self) {
        for slot in &mut self.slots {
            slot.shortcut_conflict = false;
        }
    }
}

impl SoundboardSettings {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.is_file() {
            return Ok(Self::default());
        }
        let raw = std::fs::read_to_string(path).context("read soundboard.json")?;
        let mut settings: Self = serde_json::from_str(&raw).context("parse soundboard.json")?;
        settings.normalize();
        Ok(settings)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self).context("serialize soundboard")?;
        std::fs::write(path, json).context("write soundboard.json")?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardPlayEvent {
    pub slot_index: usize,
    pub path: String,
    pub label: String,
    pub generation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardErrorEvent {
    pub message: String,
    pub slot_index: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardSlotPublic {
    pub index: usize,
    pub label: String,
    pub enabled: bool,
    pub shortcut: String,
    pub shortcut_conflict: bool,
    pub has_audio: bool,
    pub generation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundboardPublicView {
    pub enabled: bool,
    pub slots: Vec<SoundboardSlotPublic>,
}

pub fn get_soundboard_public(state: &AppArc) -> Result<SoundboardPublicView, String> {
    let sb = state.soundboard.read().map_err(|e| format!("{e}"))?;
    Ok(to_public(&sb))
}

fn to_public(sb: &SoundboardSettings) -> SoundboardPublicView {
    SoundboardPublicView {
        enabled: sb.enabled,
        slots: sb
            .slots
            .iter()
            .enumerate()
            .map(|(index, slot)| SoundboardSlotPublic {
                index,
                label: slot.label.clone(),
                enabled: slot.enabled,
                shortcut: slot.shortcut.clone(),
                shortcut_conflict: slot.shortcut_conflict,
                has_audio: !slot.audio.is_empty(),
                generation_id: match &slot.audio {
                    SoundboardAudio::Generation { id } => Some(id.clone()),
                    _ => None,
                },
            })
            .collect(),
    }
}

pub fn resolve_slot_path(state: &AppArc, slot: &SoundboardSlot) -> Result<PathBuf, String> {
    match &slot.audio {
        SoundboardAudio::Empty => Err("Slot nie ma przypisanego audio.".into()),
        SoundboardAudio::File { stored_path } => {
            let path = PathBuf::from(stored_path);
            if path.is_file() {
                Ok(path)
            } else {
                Err("Plik slotu nie istnieje.".into())
            }
        }
        SoundboardAudio::Generation { id } => {
            let row = state
                .db
                .get(id)
                .map_err(|e| format!("{e}"))?
                .ok_or_else(|| format!("Nie znaleziono generacji: {id}"))?;
            if row.file_path.is_empty() {
                return Err("Generacja nie ma pliku audio.".into());
            }
            let path = PathBuf::from(&row.file_path);
            if path.is_file() {
                Ok(path)
            } else {
                Err("Plik generacji nie istnieje.".into())
            }
        }
    }
}

fn ensure_soundboard_active(state: &AppArc) -> Result<(), String> {
    let plugins = state.plugins_state.read().map_err(|e| format!("{e}"))?;
    let sb = state.soundboard.read().map_err(|e| format!("{e}"))?;
    if !crate::plugins::soundboard_plugin_active(&plugins, &sb) {
        return Err(
            "Soundboard nie jest zainstalowany lub jest wyłączony. Włącz go w Rozszerzeniach."
                .into(),
        );
    }
    Ok(())
}

pub fn play_soundboard_slot_impl(
    app: &AppHandle,
    state: &AppArc,
    index: usize,
) -> Result<(), String> {
    ensure_soundboard_active(state)?;
    if index >= SOUNDBOARD_SLOT_COUNT {
        return Err(format!("Nieprawidłowy indeks slotu: {index}"));
    }
    let (slot, enabled) = {
        let sb = state.soundboard.read().map_err(|e| format!("{e}"))?;
        if !sb.enabled {
            return Err("Soundboard jest wyłączony.".into());
        }
        let slot = sb
            .slots
            .get(index)
            .ok_or_else(|| format!("Brak slotu {index}"))?
            .clone();
        (slot, sb.enabled)
    };
    let _ = enabled;
    if !slot.enabled {
        return Err(format!("Slot „{}” jest wyłączony.", slot.label));
    }
    if slot.audio.is_empty() {
        return Err(format!("Slot „{}” jest pusty.", slot.label));
    }
    let path = resolve_slot_path(state, &slot)?;
    let generation_id = match &slot.audio {
        SoundboardAudio::Generation { id } => Some(id.clone()),
        _ => None,
    };
    let _ = app.emit(
        "soundboard:play",
        SoundboardPlayEvent {
            slot_index: index,
            path: path.to_string_lossy().into_owned(),
            label: slot.label.clone(),
            generation_id,
        },
    );
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignSoundboardSlotReq {
    /// HTTP API uses snake_case; Tauri/TS uses camelCase.
    #[serde(alias = "generation_id")]
    pub generation_id: Option<String>,
    #[serde(alias = "file_path")]
    pub file_path: Option<String>,
}

pub fn set_soundboard_slot_impl(
    state: &AppArc,
    index: usize,
    req: AssignSoundboardSlotReq,
) -> Result<SoundboardPublicView, String> {
    if index >= SOUNDBOARD_SLOT_COUNT {
        return Err(format!("Nieprawidłowy indeks slotu: {index}"));
    }
    let has_gen = req
        .generation_id
        .as_ref()
        .is_some_and(|s| !s.trim().is_empty());
    let has_file = req
        .file_path
        .as_ref()
        .is_some_and(|s| !s.trim().is_empty());
    if has_gen == has_file {
        return Err("Podaj generation_id albo file_path (nie oba).".into());
    }

    let mut sb = state.soundboard.write().map_err(|e| format!("{e}"))?;
    let slot = sb
        .slots
        .get_mut(index)
        .ok_or_else(|| format!("Brak slotu {index}"))?;

    if let Some(id) = req.generation_id {
        let id = id.trim().to_string();
        state
            .db
            .get(&id)
            .map_err(|e| format!("{e}"))?
            .ok_or_else(|| format!("Nie znaleziono generacji: {id}"))?;
        remove_stored_file_if_any(state, slot);
        slot.audio = SoundboardAudio::Generation { id };
    } else if let Some(src) = req.file_path {
        let stored = copy_slot_file(state, index, src.trim())?;
        remove_stored_file_if_any(state, slot);
        slot.audio = SoundboardAudio::File {
            stored_path: stored.to_string_lossy().into_owned(),
        };
    }

    sb.normalize();
    let view = to_public(&sb);
    state
        .persist_soundboard(&sb)
        .map_err(|e| format!("{e}"))?;
    Ok(view)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchSoundboardSlotReq {
    pub label: Option<String>,
    pub shortcut: Option<String>,
    pub enabled: Option<bool>,
}

pub fn update_soundboard_slot_impl(
    state: &AppArc,
    index: usize,
    req: PatchSoundboardSlotReq,
) -> Result<SoundboardPublicView, String> {
    if index >= SOUNDBOARD_SLOT_COUNT {
        return Err(format!("Nieprawidłowy indeks slotu: {index}"));
    }
    let mut sb = state.soundboard.write().map_err(|e| format!("{e}"))?;
    let slot = sb
        .slots
        .get_mut(index)
        .ok_or_else(|| format!("Brak slotu {index}"))?;
    if let Some(label) = req.label {
        slot.label = label;
    }
    if let Some(shortcut) = req.shortcut {
        slot.shortcut = shortcut;
    }
    if let Some(enabled) = req.enabled {
        slot.enabled = enabled;
    }
    sb.normalize();
    let view = to_public(&sb);
    state
        .persist_soundboard(&sb)
        .map_err(|e| format!("{e}"))?;
    Ok(view)
}

pub fn clear_soundboard_slot_impl(
    state: &AppArc,
    index: usize,
) -> Result<SoundboardPublicView, String> {
    if index >= SOUNDBOARD_SLOT_COUNT {
        return Err(format!("Nieprawidłowy indeks slotu: {index}"));
    }
    let mut sb = state.soundboard.write().map_err(|e| format!("{e}"))?;
    let slot = sb
        .slots
        .get_mut(index)
        .ok_or_else(|| format!("Brak slotu {index}"))?;
    remove_stored_file_if_any(state, slot);
    *slot = default_slot(index);
    sb.normalize();
    let view = to_public(&sb);
    state
        .persist_soundboard(&sb)
        .map_err(|e| format!("{e}"))?;
    Ok(view)
}

pub fn soundboard_slot_audio_path(
    state: &AppArc,
    index: usize,
) -> Result<PathBuf, String> {
    if index >= SOUNDBOARD_SLOT_COUNT {
        return Err(format!("Nieprawidłowy indeks slotu: {index}"));
    }
    let sb = state.soundboard.read().map_err(|e| format!("{e}"))?;
    let slot = sb
        .slots
        .get(index)
        .ok_or_else(|| format!("Brak slotu {index}"))?;
    resolve_slot_path(state, slot)
}

fn remove_stored_file_if_any(state: &AppArc, slot: &SoundboardSlot) {
    if let SoundboardAudio::File { stored_path } = &slot.audio {
        let path = PathBuf::from(stored_path);
        if path.is_file() {
            let _ = std::fs::remove_file(path);
        }
    }
    let _ = state;
}

fn copy_slot_file(state: &AppArc, index: usize, src: &str) -> Result<PathBuf, String> {
    let src_path = PathBuf::from(src);
    if !src_path.is_file() {
        return Err(format!("Plik nie istnieje: {src}"));
    }
    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav");
    let dest = slot_storage_path(state, index, ext);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{e}"))?;
    }
    std::fs::copy(&src_path, &dest).map_err(|e| format!("kopiowanie pliku: {e}"))?;
    Ok(dest)
}

pub fn slot_storage_path(state: &AppArc, index: usize, ext: &str) -> PathBuf {
    let paths = state.paths.read().expect("paths lock");
    paths.soundboard_storage.join(format!("slot-{index}.{ext}"))
}

pub fn soundboard_settings_path(paths: &AppPaths) -> PathBuf {
    paths.plugins.join("soundboard.json")
}
