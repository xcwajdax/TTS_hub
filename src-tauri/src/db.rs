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
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub attempts: i64,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_json: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_chars: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ui_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tag_ids: Option<Vec<String>>,
    // === chat-window extension (2026-06-06) ===
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_prompt: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chat_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chat_message_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderRule {
    pub id: String,
    pub folder_id: String,
    pub match_source: String,
    pub priority: i64,
    pub enabled: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderRuleInput {
    pub id: Option<String>,
    pub folder_id: String,
    pub match_source: String,
    pub priority: i64,
    pub enabled: bool,
}

/// Usage metrics saved when a generation completes.
#[derive(Debug, Clone, Default)]
pub struct GenerationUsage {
    pub provider: Option<String>,
    pub input_chars: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageTotals {
    pub generations_done: i64,
    pub prompt_tokens: i64,
    pub output_tokens: i64,
    pub total_tokens: i64,
    pub input_chars: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSummary {
    pub all_time: UsageTotals,
    pub current_session: UsageTotals,
}

const GEN_SELECT: &str = "id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text, status, error, attempts, updated_at, request_json, provider, input_chars, prompt_tokens, output_tokens, total_tokens, folder_id, ui_color, original_prompt, chat_session_id, chat_message_id";

fn default_source() -> String {
    "manual".to_string()
}

fn default_status() -> String {
    "done".to_string()
}

pub const STATUS_QUEUED: &str = "queued";
pub const STATUS_RUNNING: &str = "running";
pub const STATUS_DONE: &str = "done";
pub const STATUS_FAILED: &str = "failed";
pub const STATUS_INTERRUPTED: &str = "interrupted";
pub const STATUS_CANCELLED: &str = "cancelled";

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    /// Acquire a short-lived `MutexGuard` on the underlying `Connection` for
    /// out-of-`Db` SQL helpers (e.g. `crate::chat::db`).
    ///
    /// The caller MUST drop the guard before awaiting or doing long work.
    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }

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
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN conversation_id TEXT",
            [],
        );
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN summary_text TEXT", []);
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN status TEXT NOT NULL DEFAULT 'done'",
            [],
        );
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN error TEXT", []);
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
            [],
        );
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN request_json TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN provider TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN input_chars INTEGER", []);
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN prompt_tokens INTEGER",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN output_tokens INTEGER",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE generations ADD COLUMN total_tokens INTEGER",
            [],
        );
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status, created_at DESC)",
            [],
        );
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_generations_session_status ON generations(session_id, status)",
            [],
        );
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN folder_id TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN ui_color TEXT", []);

        // === chat-window extension (2026-06-06) — additive, idempotent ===
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN original_prompt TEXT", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL", []);
        let _ = conn.execute("ALTER TABLE generations ADD COLUMN chat_message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL", []);
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                color TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS folder_rules (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
                match_source TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 100,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_folder_rules_match ON folder_rules(enabled, priority, match_source);
            CREATE INDEX IF NOT EXISTS idx_generations_folder ON generations(folder_id, created_at DESC);
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                color TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS generation_tags (
                generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
                tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (generation_id, tag_id)
            );
            CREATE INDEX IF NOT EXISTS idx_generation_tags_tag ON generation_tags(tag_id);
            CREATE TABLE IF NOT EXISTS roleplay_projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                doc_json TEXT NOT NULL DEFAULT '{}',
                palette_json TEXT NOT NULL DEFAULT '[]',
                timeline_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'draft'
            );
            CREATE TABLE IF NOT EXISTS roleplay_segments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES roleplay_projects(id) ON DELETE CASCADE,
                order_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                voice_profile_id TEXT NOT NULL,
                color TEXT NOT NULL,
                generation_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                retry_count INTEGER NOT NULL DEFAULT 0,
                error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_roleplay_segments_project ON roleplay_segments(project_id, order_index);

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                title TEXT,
                created_at INTEGER NOT NULL,
                last_active_at INTEGER NOT NULL,
                is_saved INTEGER NOT NULL DEFAULT 0,
                message_count INTEGER NOT NULL DEFAULT 0,
                metadata_json TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_source ON chat_sessions(source, last_active_at DESC);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_saved ON chat_sessions(is_saved, last_active_at DESC);
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                generation_id TEXT,
                created_at INTEGER NOT NULL,
                order_index INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, order_index ASC);
            "#,
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert(&self, g: &Generation) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO generations (id, created_at, text, title, model, voice, style, format, duration_ms, file_path, is_archived, session_id, source, conversation_id, summary_text, status, error, attempts, updated_at, request_json, folder_id, ui_color, original_prompt, chat_session_id, chat_message_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
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
                g.status,
                g.error,
                g.attempts,
                g.updated_at,
                g.request_json,
                g.folder_id,
                g.ui_color,
                g.original_prompt,
                g.chat_session_id,
                g.chat_message_id,
            ],
        )?;
        Ok(())
    }

    /// Visible "history" rows: only completed generations. Queued/running/interrupted/failed/cancelled
    /// are surfaced via the jobs API.
    pub fn list_session(&self, session_id: &str) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT {GEN_SELECT} FROM generations WHERE session_id = ?1 AND status = 'done' AND is_archived = 0 AND folder_id IS NULL ORDER BY created_at DESC"
        );
        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map([session_id], row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// All non-archived temp history rows across app sessions (tab „Sesja”).
    pub fn list_temp_history(&self) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT {GEN_SELECT} FROM generations WHERE status = 'done' AND is_archived = 0 AND folder_id IS NULL ORDER BY created_at DESC"
        );
        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map([], row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    /// Cursor integration feed: all non-archived cursor/cursor-skill rows in this session (any status).
    pub fn list_cursor_feed(&self, session_id: &str, limit: usize) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let lim = limit.clamp(1, 100) as i64;
        let sql = format!(
            "SELECT {GEN_SELECT} FROM generations WHERE session_id = ?1 AND source IN ('cursor', 'cursor-skill') AND is_archived = 0 ORDER BY created_at DESC LIMIT ?2"
        );
        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map((session_id, lim), row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn list_archive(&self) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT {GEN_SELECT} FROM generations WHERE is_archived = 1 ORDER BY created_at DESC"
        );
        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map([], row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get(&self, id: &str) -> Result<Option<Generation>> {
        let c = self.conn.lock().unwrap();
        let sql = format!("SELECT {GEN_SELECT} FROM generations WHERE id = ?1");
        let mut stmt = c.prepare(&sql)?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row_to_gen(row)?))
        } else {
            Ok(None)
        }
    }

    /// List jobs by status. Active = queued+running. Interrupted = the single state.
    pub fn list_by_statuses(&self, statuses: &[&str]) -> Result<Vec<Generation>> {
        if statuses.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = (1..=statuses.len())
            .map(|i| format!("?{i}"))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT {GEN_SELECT} FROM generations WHERE status IN ({placeholders}) ORDER BY created_at ASC",
        );
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> =
            statuses.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let rows = stmt.query_map(params.as_slice(), row_to_gen)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn update_status(&self, id: &str, status: &str, error: Option<&str>) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET status = ?1, error = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, error, now, id],
        )?;
        Ok(())
    }

    pub fn mark_running(&self, id: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET status = 'running', attempts = attempts + 1, error = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    /// Reset a row to queued (used by resume). Wipes error, refreshes updated_at.
    pub fn mark_queued(&self, id: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET status = 'queued', error = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    /// On successful generation, finalize file path / duration / format / title.
    pub fn finalize_done(
        &self,
        id: &str,
        file_path: &str,
        format: &str,
        duration_ms: Option<i64>,
        title: Option<&str>,
        usage: Option<&GenerationUsage>,
    ) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        if let Some(u) = usage {
            c.execute(
                "UPDATE generations SET status = 'done', file_path = ?1, format = ?2, duration_ms = ?3, title = COALESCE(?4, title), error = NULL, updated_at = ?5, provider = ?6, input_chars = ?7, prompt_tokens = ?8, output_tokens = ?9, total_tokens = ?10 WHERE id = ?11",
                params![
                    file_path,
                    format,
                    duration_ms,
                    title,
                    now,
                    u.provider,
                    u.input_chars,
                    u.prompt_tokens,
                    u.output_tokens,
                    u.total_tokens,
                    id,
                ],
            )?;
        } else {
            c.execute(
                "UPDATE generations SET status = 'done', file_path = ?1, format = ?2, duration_ms = ?3, title = COALESCE(?4, title), error = NULL, updated_at = ?5 WHERE id = ?6",
                params![file_path, format, duration_ms, title, now, id],
            )?;
        }
        Ok(())
    }

    pub fn usage_summary(&self, session_id: &str) -> Result<UsageSummary> {
        let c = self.conn.lock().unwrap();
        Ok(UsageSummary {
            all_time: query_usage_totals(&c, None)?,
            current_session: query_usage_totals(&c, Some(session_id))?,
        })
    }

    /// Mark any leftover queued/running rows as interrupted on startup. Returns affected ids.
    pub fn mark_orphans_interrupted(&self) -> Result<Vec<String>> {
        let c = self.conn.lock().unwrap();
        let mut stmt =
            c.prepare("SELECT id FROM generations WHERE status IN ('queued','running')")?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        if !ids.is_empty() {
            let now = chrono::Utc::now().timestamp_millis();
            c.execute(
                "UPDATE generations SET status = 'interrupted', updated_at = ?1 WHERE status IN ('queued','running')",
                params![now],
            )?;
        }
        Ok(ids)
    }

    pub fn update_title(&self, id: &str, title: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET title = ?1 WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    pub fn update_ui_color(&self, id: &str, ui_color: Option<&str>) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET ui_color = ?1 WHERE id = ?2",
            params![ui_color, id],
        )?;
        Ok(())
    }

    pub fn update_archived(
        &self,
        id: &str,
        archived: bool,
        new_path: &str,
        format: &str,
        folder_id: Option<&str>,
    ) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET is_archived = ?1, file_path = ?2, format = ?3, folder_id = ?4 WHERE id = ?5",
            params![archived as i32, new_path, format, folder_id, id],
        )?;
        Ok(())
    }

    pub fn set_folder_id(&self, id: &str, folder_id: Option<&str>) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET folder_id = ?1 WHERE id = ?2",
            params![folder_id, id],
        )?;
        Ok(())
    }

    pub fn list_generations_in_folder(&self, folder_id: Option<&str>) -> Result<Vec<Generation>> {
        let c = self.conn.lock().unwrap();
        let sql = if let Some(fid) = folder_id {
            format!(
                "SELECT {GEN_SELECT} FROM generations WHERE is_archived = 1 AND folder_id = ?1 ORDER BY created_at DESC"
            )
        } else {
            format!(
                "SELECT {GEN_SELECT} FROM generations WHERE is_archived = 1 AND folder_id IS NULL ORDER BY created_at DESC"
            )
        };
        let mut stmt = c.prepare(&sql)?;
        let rows = if let Some(fid) = folder_id {
            stmt.query_map([fid], row_to_gen)?
        } else {
            stmt.query_map([], row_to_gen)?
        };
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn generation_paths_for_folder(&self, folder_id: &str) -> Result<Vec<(String, String)>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, file_path FROM generations WHERE folder_id = ?1 AND file_path != ''",
        )?;
        let rows = stmt.query_map([folder_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn unassign_folder_generations(&self, folder_id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE generations SET folder_id = NULL WHERE folder_id = ?1",
            params![folder_id],
        )?;
        Ok(())
    }

    // --- Folders ---

    pub fn folder_list(&self) -> Result<Vec<Folder>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, name, slug, color, sort_order, created_at FROM folders ORDER BY sort_order ASC, name ASC",
        )?;
        let rows = stmt.query_map([], row_to_folder)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn folder_by_id(&self, id: &str) -> Result<Option<Folder>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, name, slug, color, sort_order, created_at FROM folders WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row_to_folder(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn folder_slugs(&self) -> Result<Vec<String>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare("SELECT slug FROM folders")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn folder_insert(&self, f: &Folder) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO folders (id, name, slug, color, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                f.id,
                f.name,
                f.slug,
                f.color,
                f.sort_order,
                f.created_at
            ],
        )?;
        Ok(())
    }

    pub fn folder_update_meta(
        &self,
        id: &str,
        name: &str,
        slug: &str,
        color: Option<&str>,
    ) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE folders SET name = ?1, slug = ?2, color = ?3 WHERE id = ?4",
            params![name, slug, color, id],
        )?;
        Ok(())
    }

    pub fn folder_delete(&self, id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn folder_max_sort_order(&self) -> Result<i64> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare("SELECT COALESCE(MAX(sort_order), -1) FROM folders")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(row.get(0)?)
        } else {
            Ok(-1)
        }
    }

    // --- Folder rules ---

    pub fn folder_rules_list(&self) -> Result<Vec<FolderRule>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, folder_id, match_source, priority, enabled, created_at FROM folder_rules ORDER BY priority ASC, created_at ASC",
        )?;
        let rows = stmt.query_map([], row_to_folder_rule)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn folder_rule_match(&self, source: &str) -> Result<Option<String>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT folder_id FROM folder_rules WHERE enabled = 1 AND (match_source = ?1 OR match_source = '*') ORDER BY priority ASC, created_at ASC LIMIT 1",
        )?;
        let mut rows = stmt.query([source])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn folder_rule_upsert(&self, rule: &FolderRule) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO folder_rules (id, folder_id, match_source, priority, enabled, created_at) VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(id) DO UPDATE SET folder_id=?2, match_source=?3, priority=?4, enabled=?5",
            params![
                rule.id,
                rule.folder_id,
                rule.match_source,
                rule.priority,
                rule.enabled as i32,
                rule.created_at
            ],
        )?;
        Ok(())
    }

    pub fn folder_rule_delete(&self, id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM folder_rules WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn tag_list(&self) -> Result<Vec<Tag>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, name, slug, color, sort_order, created_at FROM tags ORDER BY sort_order ASC, name ASC",
        )?;
        let rows = stmt.query_map([], row_to_tag)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn tag_by_id(&self, id: &str) -> Result<Option<Tag>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, name, slug, color, sort_order, created_at FROM tags WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row_to_tag(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn tag_slugs(&self) -> Result<Vec<String>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare("SELECT slug FROM tags")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn tag_insert(&self, t: &Tag) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO tags (id, name, slug, color, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
            params![t.id, t.name, t.slug, t.color, t.sort_order, t.created_at],
        )?;
        Ok(())
    }

    pub fn tag_update_meta(
        &self,
        id: &str,
        name: &str,
        slug: &str,
        color: Option<&str>,
    ) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE tags SET name = ?1, slug = ?2, color = ?3 WHERE id = ?4",
            params![name, slug, color, id],
        )?;
        Ok(())
    }

    pub fn tag_delete(&self, id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn tag_max_sort_order(&self) -> Result<i64> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare("SELECT COALESCE(MAX(sort_order), -1) FROM tags")?;
        let v: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(v)
    }

    pub fn generation_tags_for_ids(
        &self,
        generation_ids: &[String],
    ) -> Result<std::collections::HashMap<String, Vec<String>>> {
        let mut out = std::collections::HashMap::new();
        if generation_ids.is_empty() {
            return Ok(out);
        }
        let c = self.conn.lock().unwrap();
        let placeholders = generation_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT generation_id, tag_id FROM generation_tags WHERE generation_id IN ({placeholders})"
        );
        let mut stmt = c.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = generation_ids
            .iter()
            .map(|s| s as &dyn rusqlite::ToSql)
            .collect();
        let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows.flatten() {
            out.entry(row.0).or_default().push(row.1);
        }
        Ok(out)
    }

    pub fn set_generation_tags(&self, generation_id: &str, tag_ids: &[String]) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "DELETE FROM generation_tags WHERE generation_id = ?1",
            params![generation_id],
        )?;
        for tag_id in tag_ids {
            c.execute(
                "INSERT INTO generation_tags (generation_id, tag_id) VALUES (?1, ?2)",
                params![generation_id, tag_id],
            )?;
        }
        Ok(())
    }

    pub fn count_generations(&self) -> Result<usize> {
        let c = self.conn.lock().unwrap();
        let n: i64 = c.query_row("SELECT COUNT(*) FROM generations", [], |row| row.get(0))?;
        Ok(n as usize)
    }

    /// Removes all history, folders, tags and rules. Settings file is not touched.
    pub fn clear_all_user_data(&self) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute_batch(
            "DELETE FROM generation_tags;
             DELETE FROM generations;
             DELETE FROM folder_rules;
             DELETE FROM folders;
             DELETE FROM tags;",
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
            "SELECT created_at FROM generations WHERE source IN ('cursor', 'cursor-skill') ORDER BY created_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    /// Enforces global temp history cap: current session is never trimmed; oldest prior-session
    /// rows are removed when total exceeds `max_items`. Job-state rows are never touched.
    /// Returns removed file paths so caller can delete them from disk.
    pub fn enforce_temp_retention(
        &self,
        max_items: u32,
        current_session: &str,
    ) -> Result<Vec<String>> {
        let max = max_items as usize;
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, file_path, session_id FROM generations
             WHERE status = 'done' AND is_archived = 0 AND folder_id IS NULL
             ORDER BY created_at ASC",
        )?;
        let rows: Vec<(String, String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .filter_map(|r| r.ok())
            .collect();

        let current_count = rows
            .iter()
            .filter(|(_, _, sid)| sid == current_session)
            .count();
        let mut prior: Vec<(String, String)> = rows
            .into_iter()
            .filter(|(_, _, sid)| sid != current_session)
            .map(|(id, path, _)| (id, path))
            .collect();

        let mut total = current_count + prior.len();
        let mut removed_paths = Vec::new();
        while total > max && !prior.is_empty() {
            let (id, path) = prior.remove(0);
            removed_paths.push(path);
            let _ = c.execute("DELETE FROM generations WHERE id = ?1", params![id]);
            total -= 1;
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
        source: row
            .get::<_, Option<String>>(12)?
            .unwrap_or_else(|| "manual".to_string()),
        conversation_id: row.get(13)?,
        summary_text: row.get(14)?,
        status: row
            .get::<_, Option<String>>(15)?
            .unwrap_or_else(|| "done".to_string()),
        error: row.get(16)?,
        attempts: row.get::<_, Option<i64>>(17)?.unwrap_or(0),
        updated_at: row.get::<_, Option<i64>>(18)?.unwrap_or(0),
        request_json: row.get(19)?,
        provider: row.get(20)?,
        input_chars: row.get(21)?,
        prompt_tokens: row.get(22)?,
        output_tokens: row.get(23)?,
        total_tokens: row.get(24)?,
        folder_id: row.get(25)?,
        ui_color: row.get(26)?,
        tag_ids: None,
        original_prompt: row.get(27)?,
        chat_session_id: row.get(28)?,
        chat_message_id: row.get(29)?,
    })
}

fn row_to_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        slug: row.get(2)?,
        color: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        slug: row.get(2)?,
        color: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn row_to_folder_rule(row: &rusqlite::Row) -> rusqlite::Result<FolderRule> {
    Ok(FolderRule {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        match_source: row.get(2)?,
        priority: row.get(3)?,
        enabled: row.get::<_, i32>(4)? != 0,
        created_at: row.get(5)?,
    })
}

fn row_to_roleplay_project(row: &rusqlite::Row) -> rusqlite::Result<crate::roleplay::RoleplayProject> {
    Ok(crate::roleplay::RoleplayProject {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
        doc_json: row.get(4)?,
        palette_json: row.get(5)?,
        timeline_json: row.get(6)?,
        status: row.get(7)?,
        segments: Vec::new(),
    })
}

fn row_to_roleplay_segment(row: &rusqlite::Row) -> rusqlite::Result<crate::roleplay::RoleplaySegment> {
    Ok(crate::roleplay::RoleplaySegment {
        id: row.get(0)?,
        project_id: row.get(1)?,
        order_index: row.get(2)?,
        text: row.get(3)?,
        voice_profile_id: row.get(4)?,
        color: row.get(5)?,
        generation_id: row.get(6)?,
        status: row.get(7)?,
        retry_count: row.get::<_, Option<i64>>(8)?.unwrap_or(0),
        error: row.get(9)?,
    })
}

impl Db {
    pub fn roleplay_list_projects(&self) -> Result<Vec<crate::roleplay::RoleplayProjectSummary>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT p.id, p.name, p.created_at, p.updated_at, p.status,
                    (SELECT COUNT(*) FROM roleplay_segments s WHERE s.project_id = p.id) AS segment_count
             FROM roleplay_projects p
             ORDER BY p.updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::roleplay::RoleplayProjectSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                status: row.get(4)?,
                segment_count: row.get(5)?,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn roleplay_create_project(&self, name: &str) -> Result<crate::roleplay::RoleplayProject> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let project = crate::roleplay::RoleplayProject {
            id: id.clone(),
            name: name.to_string(),
            created_at: now,
            updated_at: now,
            doc_json: r#"{"type":"doc","content":[{"type":"paragraph"}]}"#.to_string(),
            palette_json: "[]".to_string(),
            timeline_json: r#"{"tracks":[],"clips":[]}"#.to_string(),
            status: crate::roleplay::project::PROJECT_STATUS_DRAFT.to_string(),
            segments: Vec::new(),
        };
        let c = self.conn.lock().unwrap();
        c.execute(
            "INSERT INTO roleplay_projects (id, name, created_at, updated_at, doc_json, palette_json, timeline_json, status)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                project.id,
                project.name,
                project.created_at,
                project.updated_at,
                project.doc_json,
                project.palette_json,
                project.timeline_json,
                project.status,
            ],
        )?;
        Ok(project)
    }

    pub fn roleplay_get_project(&self, id: &str) -> Result<Option<crate::roleplay::RoleplayProject>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, name, created_at, updated_at, doc_json, palette_json, timeline_json, status
             FROM roleplay_projects WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map([id], row_to_roleplay_project)?;
        let mut project = match rows.next() {
            Some(Ok(p)) => p,
            Some(Err(e)) => return Err(e.into()),
            None => return Ok(None),
        };
        project.segments = self.roleplay_list_segments_inner(&c, id)?;
        Ok(Some(project))
    }

    fn roleplay_list_segments_inner(
        &self,
        c: &Connection,
        project_id: &str,
    ) -> Result<Vec<crate::roleplay::RoleplaySegment>> {
        let mut stmt = c.prepare(
            "SELECT id, project_id, order_index, text, voice_profile_id, color, generation_id, status, retry_count, error
             FROM roleplay_segments WHERE project_id = ?1 ORDER BY order_index ASC",
        )?;
        let rows = stmt.query_map([project_id], row_to_roleplay_segment)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn roleplay_delete_project(&self, id: &str) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute("DELETE FROM roleplay_projects WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn roleplay_save_project(
        &self,
        req: &crate::roleplay::project::SaveRoleplayProjectReq,
    ) -> Result<crate::roleplay::RoleplayProject> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE roleplay_projects SET name = ?2, updated_at = ?3, doc_json = ?4, palette_json = ?5,
             timeline_json = ?6, status = ?7 WHERE id = ?1",
            params![
                req.id,
                req.name,
                now,
                req.doc_json,
                req.palette_json,
                req.timeline_json,
                req.status,
            ],
        )?;
        c.execute(
            "DELETE FROM roleplay_segments WHERE project_id = ?1",
            [&req.id],
        )?;
        for seg in &req.segments {
            c.execute(
                "INSERT INTO roleplay_segments (id, project_id, order_index, text, voice_profile_id, color, generation_id, status, retry_count, error)
                 VALUES (?1,?2,?3,?4,?5,?6,NULL,'pending',0,NULL)",
                params![
                    seg.id,
                    req.id,
                    seg.order_index,
                    seg.text,
                    seg.voice_profile_id,
                    seg.color,
                ],
            )?;
        }
        drop(c);
        self.roleplay_get_project(&req.id)?
            .ok_or_else(|| anyhow::anyhow!("project not found after save"))
    }

    pub fn roleplay_update_timeline(&self, project_id: &str, timeline_json: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE roleplay_projects SET timeline_json = ?2, updated_at = ?3 WHERE id = ?1",
            params![project_id, timeline_json, now],
        )?;
        Ok(())
    }

    pub fn roleplay_update_project_status(&self, project_id: &str, status: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE roleplay_projects SET status = ?2, updated_at = ?3 WHERE id = ?1",
            params![project_id, status, now],
        )?;
        Ok(())
    }

    pub fn roleplay_segment_by_generation(
        &self,
        generation_id: &str,
    ) -> Result<Option<crate::roleplay::RoleplaySegment>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, project_id, order_index, text, voice_profile_id, color, generation_id, status, retry_count, error
             FROM roleplay_segments WHERE generation_id = ?1 LIMIT 1",
        )?;
        let mut rows = stmt.query_map([generation_id], row_to_roleplay_segment)?;
        Ok(rows.next().transpose()?)
    }

    pub fn roleplay_update_segment(
        &self,
        seg: &crate::roleplay::RoleplaySegment,
    ) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE roleplay_segments SET order_index = ?2, text = ?3, voice_profile_id = ?4, color = ?5,
             generation_id = ?6, status = ?7, retry_count = ?8, error = ?9 WHERE id = ?1",
            params![
                seg.id,
                seg.order_index,
                seg.text,
                seg.voice_profile_id,
                seg.color,
                seg.generation_id,
                seg.status,
                seg.retry_count,
                seg.error,
            ],
        )?;
        Ok(())
    }

    pub fn roleplay_reset_generating_segments(&self) -> Result<()> {
        let c = self.conn.lock().unwrap();
        c.execute(
            "UPDATE roleplay_segments SET status = 'pending', generation_id = NULL
             WHERE status IN ('generating', 'queued')",
            [],
        )?;
        Ok(())
    }

    pub fn roleplay_pending_segments(
        &self,
        project_id: &str,
    ) -> Result<Vec<crate::roleplay::RoleplaySegment>> {
        let c = self.conn.lock().unwrap();
        let mut stmt = c.prepare(
            "SELECT id, project_id, order_index, text, voice_profile_id, color, generation_id, status, retry_count, error
             FROM roleplay_segments WHERE project_id = ?1 AND status = 'pending'
             ORDER BY order_index ASC",
        )?;
        let rows = stmt.query_map([project_id], row_to_roleplay_segment)?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_rule_match_respects_priority_and_wildcard() {
        let dir = std::env::temp_dir().join(format!("tts_hub_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");
        let db = Db::open(&db_path).unwrap();
        let now = 1_i64;
        let folder_a = Folder {
            id: "fa".into(),
            name: "A".into(),
            slug: "a".into(),
            color: None,
            sort_order: 0,
            created_at: now,
        };
        let folder_b = Folder {
            id: "fb".into(),
            name: "B".into(),
            slug: "b".into(),
            color: None,
            sort_order: 1,
            created_at: now,
        };
        db.folder_insert(&folder_a).unwrap();
        db.folder_insert(&folder_b).unwrap();
        db.folder_rule_upsert(&FolderRule {
            id: "r-wild".into(),
            folder_id: "fb".into(),
            match_source: "*".into(),
            priority: 200,
            enabled: true,
            created_at: now,
        })
        .unwrap();
        db.folder_rule_upsert(&FolderRule {
            id: "r-cursor".into(),
            folder_id: "fa".into(),
            match_source: "cursor-skill".into(),
            priority: 10,
            enabled: true,
            created_at: now,
        })
        .unwrap();
        assert_eq!(
            db.folder_rule_match("cursor-skill").unwrap().as_deref(),
            Some("fa")
        );
        assert_eq!(db.folder_rule_match("http").unwrap().as_deref(), Some("fb"));
        let _ = std::fs::remove_dir_all(dir);
    }

    fn test_gen(id: &str, session_id: &str, created_at: i64) -> Generation {
        Generation {
            id: id.into(),
            created_at,
            text: "test".into(),
            title: None,
            model: "m".into(),
            voice: "v".into(),
            style: None,
            format: "mp3".into(),
            duration_ms: None,
            file_path: format!("/tmp/{id}.mp3"),
            is_archived: false,
            session_id: session_id.into(),
            source: "manual".into(),
            conversation_id: None,
            summary_text: None,
            status: STATUS_DONE.into(),
            error: None,
            attempts: 0,
            updated_at: created_at,
            request_json: None,
            provider: None,
            input_chars: None,
            prompt_tokens: None,
            output_tokens: None,
            total_tokens: None,
            folder_id: None,
            ui_color: None,
            tag_ids: None,
            original_prompt: None,
            chat_session_id: None,
            chat_message_id: None,
        }
    }

    #[test]
    fn enforce_temp_retention_keeps_current_session_when_over_limit() {
        let dir = std::env::temp_dir().join(format!("tts_hub_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::open(&dir.join("test.db")).unwrap();
        let current = "current-session";
        for i in 0..7 {
            db.insert(&test_gen(&format!("c{i}"), current, i)).unwrap();
        }
        let removed = db.enforce_temp_retention(5, current).unwrap();
        assert!(removed.is_empty());
        assert_eq!(db.list_temp_history().unwrap().len(), 7);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn enforce_temp_retention_trims_oldest_prior_sessions() {
        let dir = std::env::temp_dir().join(format!("tts_hub_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::open(&dir.join("test.db")).unwrap();
        let current = "current-session";
        let old = "old-session";
        for i in 0..4 {
            db.insert(&test_gen(&format!("o{i}"), old, i)).unwrap();
        }
        for i in 0..2 {
            db.insert(&test_gen(&format!("c{i}"), current, 100 + i))
                .unwrap();
        }
        let removed = db.enforce_temp_retention(5, current).unwrap();
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0], "/tmp/o0.mp3");
        let remaining = db.list_temp_history().unwrap();
        assert_eq!(remaining.len(), 5);
        assert!(remaining.iter().all(|g| g.id != "o0"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn enforce_temp_retention_skips_job_state_rows() {
        let dir = std::env::temp_dir().join(format!("tts_hub_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::open(&dir.join("test.db")).unwrap();
        let current = "current-session";
        let mut interrupted = test_gen("job1", "other", 1);
        interrupted.status = STATUS_INTERRUPTED.into();
        db.insert(&interrupted).unwrap();
        db.insert(&test_gen("d1", "other", 2)).unwrap();
        db.insert(&test_gen("d2", "other", 3)).unwrap();
        db.insert(&test_gen("c1", current, 4)).unwrap();
        let removed = db.enforce_temp_retention(2, current).unwrap();
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0], "/tmp/d1.mp3");
        assert!(db.get("job1").unwrap().is_some());
        let _ = std::fs::remove_dir_all(dir);
    }
}

fn query_usage_totals(c: &Connection, session_id: Option<&str>) -> Result<UsageTotals> {
    let mut stmt = if session_id.is_some() {
        c.prepare(
            "SELECT COUNT(*), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(output_tokens),0), COALESCE(SUM(total_tokens),0), COALESCE(SUM(input_chars),0) FROM generations WHERE status = 'done' AND session_id = ?1",
        )?
    } else {
        c.prepare(
            "SELECT COUNT(*), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(output_tokens),0), COALESCE(SUM(total_tokens),0), COALESCE(SUM(input_chars),0) FROM generations WHERE status = 'done'",
        )?
    };
    let mut rows = if let Some(sid) = session_id {
        stmt.query([sid])?
    } else {
        stmt.query([])?
    };
    let row = rows.next()?.unwrap();
    Ok(UsageTotals {
        generations_done: row.get(0)?,
        prompt_tokens: row.get(1)?,
        output_tokens: row.get(2)?,
        total_tokens: row.get(3)?,
        input_chars: row.get(4)?,
    })
}
