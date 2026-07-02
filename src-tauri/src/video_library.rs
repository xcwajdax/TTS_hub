use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

use crate::audio::ensure_ffmpeg;
use crate::db::Db;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoExportRecord {
    pub id: String,
    pub generation_id: String,
    pub template_id: String,
    pub file_path: String,
    pub thumb_path: Option<String>,
    pub duration_ms: Option<i64>,
    pub file_size_bytes: i64,
    pub render_params_hash: String,
    pub created_at: i64,
    pub source: String,
    pub title: Option<String>,
    #[serde(default)]
    pub is_private: bool,
}

pub fn videos_archive_dir(archive_root: &Path) -> PathBuf {
    archive_root.join("videos")
}

pub fn ensure_videos_archive_dir(archive_root: &Path) -> Result<PathBuf> {
    let dir = videos_archive_dir(archive_root);
    std::fs::create_dir_all(&dir).context("create archive/videos dir")?;
    Ok(dir)
}

pub fn insert_video_export(db: &Db, record: &VideoExportRecord) -> Result<()> {
    let conn = db.conn();
    conn.execute(
        r#"INSERT INTO video_exports (
            id, generation_id, template_id, file_path, thumb_path,
            duration_ms, file_size_bytes, render_params_hash, created_at, source, title, is_private
        ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"#,
        rusqlite::params![
            record.id,
            record.generation_id,
            record.template_id,
            record.file_path,
            record.thumb_path,
            record.duration_ms,
            record.file_size_bytes,
            record.render_params_hash,
            record.created_at,
            record.source,
            record.title,
            record.is_private as i32,
        ],
    )?;
    Ok(())
}

pub fn list_video_exports(db: &Db, limit: u32, offset: u32) -> Result<Vec<VideoExportRecord>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        r#"SELECT id, generation_id, template_id, file_path, thumb_path,
                  duration_ms, file_size_bytes, render_params_hash, created_at, source, title, is_private
           FROM video_exports
           ORDER BY created_at DESC
           LIMIT ?1 OFFSET ?2"#,
    )?;
    let rows = stmt.query_map(rusqlite::params![limit, offset], map_video_export_row)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().context("list video exports")
}

pub fn get_video_export(db: &Db, id: &str) -> Result<Option<VideoExportRecord>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        r#"SELECT id, generation_id, template_id, file_path, thumb_path,
                  duration_ms, file_size_bytes, render_params_hash, created_at, source, title, is_private
           FROM video_exports WHERE id = ?1"#,
    )?;
    let mut rows = stmt.query(rusqlite::params![id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(map_video_export_row(row)?));
    }
    Ok(None)
}

pub fn delete_video_export(db: &Db, id: &str) -> Result<Option<VideoExportRecord>> {
    let existing = get_video_export(db, id)?;
    let Some(record) = existing else {
        return Ok(None);
    };
    let conn = db.conn();
    conn.execute("DELETE FROM video_exports WHERE id = ?1", rusqlite::params![id])?;
    if Path::new(&record.file_path).is_file() {
        let _ = std::fs::remove_file(&record.file_path);
    }
    if let Some(thumb) = record.thumb_path.as_ref() {
        if Path::new(thumb).is_file() {
            let _ = std::fs::remove_file(thumb);
        }
    }
    Ok(Some(record))
}

fn map_video_export_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<VideoExportRecord> {
    Ok(VideoExportRecord {
        id: row.get(0)?,
        generation_id: row.get(1)?,
        template_id: row.get(2)?,
        file_path: row.get(3)?,
        thumb_path: row.get(4)?,
        duration_ms: row.get(5)?,
        file_size_bytes: row.get(6)?,
        render_params_hash: row.get(7)?,
        created_at: row.get(8)?,
        source: row.get(9)?,
        title: row.get(10)?,
        is_private: row.get::<_, Option<i32>>(11)?.unwrap_or(0) != 0,
    })
}

pub fn archive_mp4_copy(
    src: &Path,
    archive_root: &Path,
    export_id: &str,
) -> Result<PathBuf> {
    let dir = ensure_videos_archive_dir(archive_root)?;
    let dest = dir.join(format!("{export_id}.mp4"));
    if src != dest.as_path() {
        std::fs::copy(src, &dest).context("copy mp4 to archive")?;
    }
    Ok(dest)
}

pub fn generate_thumbnail(video: &Path, thumb_dest: &Path) -> Result<()> {
    ensure_ffmpeg()?;
    if let Some(parent) = thumb_dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(video)
        .arg("-ss")
        .arg("0")
        .arg("-vframes")
        .arg("1")
        .arg("-q:v")
        .arg("3")
        .arg(thumb_dest)
        .status()
        .context("spawn ffmpeg thumbnail")?;
    if !status.success() {
        anyhow::bail!("ffmpeg thumbnail failed");
    }
    Ok(())
}

pub fn file_size_bytes(path: &Path) -> i64 {
    std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0)
}

pub fn new_export_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn build_render_hash(
    template_id: &str,
    generation_id: &str,
    src_mtime_ms: u128,
    subtitle_mtime_ms: Option<u128>,
) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    template_id.hash(&mut hasher);
    generation_id.hash(&mut hasher);
    src_mtime_ms.hash(&mut hasher);
    subtitle_mtime_ms.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
