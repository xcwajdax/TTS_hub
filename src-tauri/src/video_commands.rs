use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::paths::AppPaths;
use crate::state::AppState;
use crate::video_library::{
    delete_video_export, get_video_export, insert_video_export,
    list_video_exports as db_list_video_exports, new_export_id, VideoExportRecord,
};
use crate::video_template::{
    delete_user_template, duplicate_template, ensure_builtin_template, list_template_metas,
    load_template_by_id, preset_landscape_169, preset_portrait_916, save_template_file,
    template_file_path, VideoTemplate, VideoTemplateMeta, BUILTIN_WHATSAPP_ID,
};

type AppArc = Arc<AppState>;

fn err(e: impl std::fmt::Display) -> String {
    format!("{e}")
}

fn read_paths(state: &AppArc) -> Result<std::sync::RwLockReadGuard<'_, AppPaths>, String> {
    state.paths.read().map_err(|e| err(e))
}

#[tauri::command]
pub fn list_video_templates(state: State<'_, AppArc>) -> Result<Vec<VideoTemplateMeta>, String> {
    let paths = read_paths(&state)?;
    list_template_metas(&paths.root).map_err(err)
}

#[tauri::command]
pub fn get_video_template(id: String, state: State<'_, AppArc>) -> Result<VideoTemplate, String> {
    let paths = read_paths(&state)?;
    load_template_by_id(&paths.root, &id).map_err(err)
}

#[tauri::command]
pub fn save_video_template(
    template: VideoTemplate,
    state: State<'_, AppArc>,
) -> Result<VideoTemplate, String> {
    if template.id == BUILTIN_WHATSAPP_ID {
        return Err("cannot overwrite built-in template".into());
    }
    template.validate().map_err(err)?;
    let paths = read_paths(&state)?;
    let path = template_file_path(&paths.video_templates, &template.id);
    save_template_file(&path, &template).map_err(err)?;
    Ok(template)
}

#[tauri::command]
pub fn delete_video_template(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    let paths = read_paths(&state)?;
    delete_user_template(&paths.root, &id).map_err(err)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateVideoTemplateArgs {
    pub source_id: String,
    pub name: String,
}

#[tauri::command]
pub fn duplicate_video_template(
    args: DuplicateVideoTemplateArgs,
    state: State<'_, AppArc>,
) -> Result<VideoTemplate, String> {
    let paths = read_paths(&state)?;
    duplicate_template(&paths.root, &args.source_id, &args.name).map_err(err)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewVideoTemplateFromPresetArgs {
    pub preset: String,
    pub name: String,
}

#[tauri::command]
pub fn new_video_template_from_preset(
    args: NewVideoTemplateFromPresetArgs,
    state: State<'_, AppArc>,
) -> Result<VideoTemplate, String> {
    let mut tpl = match args.preset.as_str() {
        "portrait-916" => preset_portrait_916(),
        "landscape-169" => preset_landscape_169(),
        _ => VideoTemplate::builtin_whatsapp(),
    };
    tpl.id = uuid::Uuid::new_v4().to_string();
    tpl.name = args.name.trim().to_string();
    if tpl.name.is_empty() {
        tpl.name = "Nowy szablon".to_string();
    }
    let paths = read_paths(&state)?;
    let path = template_file_path(&paths.video_templates, &tpl.id);
    save_template_file(&path, &tpl).map_err(err)?;
    Ok(tpl)
}

#[tauri::command]
pub fn list_video_exports(
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppArc>,
) -> Result<Vec<VideoExportRecord>, String> {
    db_list_video_exports(&state.db, limit.unwrap_or(100), offset.unwrap_or(0)).map_err(err)
}

#[tauri::command]
pub fn get_video_export_by_id(
    id: String,
    state: State<'_, AppArc>,
) -> Result<Option<VideoExportRecord>, String> {
    get_video_export(&state.db, &id).map_err(err)
}

#[tauri::command]
pub fn delete_video_export_by_id(id: String, state: State<'_, AppArc>) -> Result<(), String> {
    delete_video_export(&state.db, &id).map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn copy_video_export_to_clipboard(
    id: String,
    state: State<'_, AppArc>,
) -> Result<(), String> {
    let record = get_video_export(&state.db, &id)
        .map_err(err)?
        .ok_or_else(|| "export not found".to_string())?;
    let path = PathBuf::from(&record.file_path);
    if !path.is_file() {
        return Err("plik wideo nie istnieje".into());
    }
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("schowek: {e}"))?;
    clipboard
        .set()
        .file_list(&[path.as_path()])
        .map_err(|e| format!("kopiowanie do schowka: {e}"))?;
    Ok(())
}

pub fn ensure_video_subsystem(state: &AppArc) -> Result<(), String> {
    let paths = read_paths(state)?;
    ensure_builtin_template(&paths.root).map_err(err)?;
    Ok(())
}

pub fn insert_archived_export(state: &AppArc, record: &VideoExportRecord) -> Result<(), String> {
    insert_video_export(&state.db, record).map_err(err)
}

pub fn new_video_export_record(
    generation_id: &str,
    template_id: &str,
    file_path: PathBuf,
    thumb_path: Option<PathBuf>,
    duration_ms: Option<i64>,
    render_hash: &str,
    source: &str,
    title: Option<String>,
    is_private: bool,
) -> VideoExportRecord {
    VideoExportRecord {
        id: new_export_id(),
        generation_id: generation_id.to_string(),
        template_id: template_id.to_string(),
        file_path: file_path.to_string_lossy().to_string(),
        thumb_path: thumb_path.map(|p| p.to_string_lossy().to_string()),
        duration_ms,
        file_size_bytes: crate::video_library::file_size_bytes(&file_path),
        render_params_hash: render_hash.to_string(),
        created_at: unix_now(),
        source: source.to_string(),
        title,
        is_private,
    }
}

fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTemplatePreviewResult {
    pub path: String,
}

#[tauri::command]
pub fn preview_video_template_frame(
    template: VideoTemplate,
    state: State<'_, AppArc>,
) -> Result<VideoTemplatePreviewResult, String> {
    use crate::video_export::{export_still_video_with_audio, ShareVideoExportOptions};

    template.validate().map_err(err)?;
    let paths = read_paths(&state)?;
    let cache_dir = paths.temp.join("template_previews");
    std::fs::create_dir_all(&cache_dir).map_err(err)?;

    let preview_id = uuid::Uuid::new_v4().to_string();
    let dest = cache_dir.join(format!("{preview_id}.mp4"));

    let cover = find_preview_cover(&paths);
    let audio = find_sample_audio(&paths.temp).unwrap_or_else(|| {
        let p = cache_dir.join("_preview_silence.wav");
        let _ = create_silent_wav(&p, 3000);
        p
    });

    let mut opts = ShareVideoExportOptions::default();
    crate::video_export::apply_template_to_opts(&mut opts, &template);
    opts.footer_line = Some("Przykładowy głos · model · 0:30 · TTS Hub".to_string());
    opts.fallback_karaoke_text = Some(
        "To jest przykładowa linia karaoke do podglądu szablonu wideo.".to_string(),
    );
    opts.karaoke_enabled = true;

    export_still_video_with_audio(&audio, &cover, &dest, &opts).map_err(err)?;

    Ok(VideoTemplatePreviewResult {
        path: dest.to_string_lossy().to_string(),
    })
}

fn find_preview_cover(paths: &AppPaths) -> PathBuf {
    for candidate in [
        paths.avatars.join("default.png"),
        paths.temp.join("clipboard_cache").join("default_cover.png"),
    ] {
        if candidate.is_file() {
            return candidate;
        }
    }
    paths.avatars.clone()
}

fn find_sample_audio(temp: &std::path::Path) -> Option<PathBuf> {
    if let Ok(entries) = std::fs::read_dir(temp) {
        for entry in entries.flatten() {
            let p = entry.path();
            if matches!(
                p.extension().and_then(|e| e.to_str()),
                Some("wav" | "mp3" | "ogg")
            ) {
                return Some(p);
            }
        }
    }
    None
}

fn create_silent_wav(path: &std::path::Path, duration_ms: u32) -> anyhow::Result<()> {
    use std::io::Write;
    let sample_rate = 24000u32;
    let samples = (sample_rate as u64 * duration_ms as u64) / 1000;
    let data_size = (samples * 2) as u32;
    let mut file = std::fs::File::create(path)?;
    file.write_all(b"RIFF")?;
    file.write_all(&(36 + data_size).to_le_bytes())?;
    file.write_all(b"WAVEfmt ")?;
    file.write_all(&16u32.to_le_bytes())?;
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&sample_rate.to_le_bytes())?;
    file.write_all(&(sample_rate * 2).to_le_bytes())?;
    file.write_all(&2u16.to_le_bytes())?;
    file.write_all(&16u16.to_le_bytes())?;
    file.write_all(b"data")?;
    file.write_all(&data_size.to_le_bytes())?;
    file.write_all(&vec![0u8; data_size as usize])?;
    Ok(())
}
