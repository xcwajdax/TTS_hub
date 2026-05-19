use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Generation {
    pub id: String,
    pub created_at: i64,
    pub text: String,
    pub title: Option<String>,
    pub model: String,
    pub voice: String,
    pub style: Option<String>,
    pub format: String,
    pub duration_ms: Option<i64>,
    pub file_path: String,
    pub is_archived: bool,
    pub session_id: String,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub summary_text: Option<String>,
}

fn default_source() -> String {
    "manual".to_string()
}

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                created_at INTEGER NOT NULL,
                text TEXT NOT NULL,
                model TEXT NOT NULL,
                voice TEXT NOT NULL,
                style TEXT,
                format TEXT NOT NULL,
                duration_ms INTEGER,
                file_path TEXT NOT NULL,
                is_archived INTEGER NOT NULL DEFAULT 0,
                session_id TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_generations_session ON generations(session_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_generations_archive ON generations(is_archived, created_at DESC);
            "#,
        )?;
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN title TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN conversation_id TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN summary_text TEXT", []);
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn insert(&self, g: &Generation) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO generations (id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                g.id,
                g.created_at,
                g.text,
                g.title,
                g.model,
                g.voice,
                g.style,
                g.format,
                g.duration_ms,
                g.file_path,
                g.is_archived as i32,
                g.session_id,
                g.source,
                g.conversation_id,
                g.summary_text,
            ],
        )?;
        Ok(())
    }

    pub fn list_session(&self, session_id: &str) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text
             FROM generations WHERE session_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([session_id], row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn list_archive(&self) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text
             FROM generations WHERE is_archived = 1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get(&self, id: &str) -> Result<Option<Generation>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text FROM generations WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row_to_gen(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn update_title(&self, id: &str, title: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET title = ?1 WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    pub fn update_archived(&self, id: &str, archived: bool, new_path: &str, format: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET is_archived = ?1, file_path = ?2, format = ?3 WHERE id = ?4",
            params![archived as i32, new_path, format, id],
        )?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM generations WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn last_cursor_at(&self) -> Result<Option<i64>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT created_at FROM generations WHERE source = 'cursor' ORDER BY created_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn cleanup_non_archived_from_other_sessions(&self, current_session: &str) -> Result<Vec<String>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, file_path FROM generations WHERE is_archived = 0 AND session_id != ?1",
        )?;
        let rows = stmt.query_map([current_session], |row| {
            let id: String = row.get(0)?;
            let path: String = row.get(1)?;
            Ok((id, path))
        })?;
        let mut removed_paths = Vec::new();
        let collected: Vec<(String, String)> = rows.filter_map(|r| r.ok()).collect();
        for (id, path) in collected {
            removed_paths.push(path);
            let _ = c.execute("DELETE FROM generations WHERE id = ?1", params![id]);
        }
        Ok(removed_paths)
    }
}

fn row_to_gen(row: &rusqlite::Row) -> rusqlite::Result<Generation> {
    Ok(Generation {
        id: row.get(0)?,
        created_at: row.get(1)?,
        text: row.get(2)?,
        title: row.get(3)?,
        model: row.get(4)?,
        voice: row.get(5)?,
        style: row.get(6)?,
        format: row.get(7)?,
        duration_ms: row.get(8)?,
        file_path: row.get(9)?,
        is_archived: row.get::<_, i32>(10)? != 0,
        session_id: row.get(11)?,
        source: row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "manual".to_string()),
        conversation_id: row.get(13)?,
        summary_text: row.get(14)?,
    })
}
