//! CRUD for chat_sessions and chat_messages.
//!
//! All functions take a `&Connection` — the caller is responsible for locking
//! the Db mutex (same pattern as `crate::db`).
//!
//! ID prefixes: sessions start with `sess_`, messages with `msg_`. Mirrors
//! how `crate::db` uses `gen_` for generations.

use anyhow::Result;
use rusqlite::{params, Connection};

use crate::chat::types::{ChatMessage, ChatSession};

/// Create a new chat session. Returns the inserted row.
///
/// Default title: `"{source} {YYYY-MM-DD HH:MM}"` (UTC). User can rename later.
pub fn create_session(
    conn: &Connection,
    source: &str,
    title: Option<&str>,
) -> Result<ChatSession> {
    let id = format!("sess_{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().timestamp_millis();
    let default_title = title
        .map(String::from)
        .unwrap_or_else(|| {
            chrono::DateTime::from_timestamp_millis(now)
                .map(|d| d.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|| "Nowa sesja".to_string())
        });
    let title_for_db = title.map(String::from).unwrap_or_else(|| {
        format!("{source} {default_title}")
    });
    conn.execute(
        "INSERT INTO chat_sessions (id, source, title, created_at, last_active_at, is_saved, message_count)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
        params![id, source, title_for_db, now, now],
    )?;
    Ok(ChatSession {
        id,
        source: source.to_string(),
        title: Some(title_for_db),
        created_at: now,
        last_active_at: now,
        is_saved: false,
        message_count: 0,
        metadata_json: None,
    })
}

pub fn get_session(conn: &Connection, id: &str) -> Result<Option<ChatSession>> {
    let mut stmt = conn.prepare(
        "SELECT id, source, title, created_at, last_active_at, is_saved, message_count, metadata_json
         FROM chat_sessions WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(ChatSession {
            id: row.get(0)?,
            source: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
            last_active_at: row.get(4)?,
            is_saved: row.get::<_, i64>(5)? != 0,
            message_count: row.get(6)?,
            metadata_json: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

/// List sessions, newest-active first. `source` filter is optional;
/// `saved_only` restricts to `is_saved=1`. LIMIT 200 hard cap.
pub fn list_sessions(
    conn: &Connection,
    source: Option<&str>,
    saved_only: bool,
) -> Result<Vec<ChatSession>> {
    let mut sql = String::from(
        "SELECT id, source, title, created_at, last_active_at, is_saved, message_count, metadata_json
         FROM chat_sessions WHERE 1=1",
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(s) = source {
        sql.push_str(" AND source = ?");
        params_vec.push(Box::new(s.to_string()));
    }
    if saved_only {
        sql.push_str(" AND is_saved = 1");
    }
    sql.push_str(" ORDER BY last_active_at DESC LIMIT 200");

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| &**b).collect();
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(ChatSession {
            id: row.get(0)?,
            source: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
            last_active_at: row.get(4)?,
            is_saved: row.get::<_, i64>(5)? != 0,
            message_count: row.get(6)?,
            metadata_json: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update_session(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    is_saved: Option<bool>,
) -> Result<()> {
    if let Some(t) = title {
        conn.execute(
            "UPDATE chat_sessions SET title = ?1 WHERE id = ?2",
            params![t, id],
        )?;
    }
    if let Some(s) = is_saved {
        conn.execute(
            "UPDATE chat_sessions SET is_saved = ?1 WHERE id = ?2",
            params![s as i64, id],
        )?;
    }
    Ok(())
}

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

/// Distinct sources that have any chat_sessions row in the last `recent_ms` ms.
/// Returns Vec<(source, last_active_at)>, sorted newest first.
pub fn list_recent_sources(conn: &Connection, recent_ms: i64) -> Result<Vec<(String, i64)>> {
    let cutoff = chrono::Utc::now().timestamp_millis() - recent_ms;
    let mut stmt = conn.prepare(
        "SELECT source, MAX(last_active_at) as latest
         FROM chat_sessions
         WHERE last_active_at >= ?1
         GROUP BY source
         ORDER BY latest DESC",
    )?;
    let rows = stmt.query_map(params![cutoff], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Add a message to an existing session. Auto-assigns `order_index` as MAX+1
/// and bumps `last_active_at` + `message_count` on the session.
pub fn add_message(
    conn: &Connection,
    session_id: &str,
    role: &str,
    content: &str,
    generation_id: Option<&str>,
) -> Result<ChatMessage> {
    let id = format!("msg_{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().timestamp_millis();
    let order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(order_index), 0) + 1 FROM chat_messages WHERE session_id = ?1",
            params![session_id],
            |r| r.get(0),
        )?;
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, generation_id, created_at, order_index)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, session_id, role, content, generation_id, now, order],
    )?;
    conn.execute(
        "UPDATE chat_sessions SET last_active_at = ?1, message_count = message_count + 1 WHERE id = ?2",
        params![now, session_id],
    )?;
    Ok(ChatMessage {
        id,
        session_id: session_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        generation_id: generation_id.map(String::from),
        created_at: now,
        order_index: order,
    })
}

pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<ChatMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, generation_id, created_at, order_index
         FROM chat_messages WHERE session_id = ?1 ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(ChatMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            generation_id: row.get(4)?,
            created_at: row.get(5)?,
            order_index: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Cleanup unsaved (is_saved=0) sessions older than `max_age_ms` milliseconds.
/// Returns the count of deleted sessions.
pub fn cleanup_unsaved_older_than(conn: &Connection, max_age_ms: i64) -> Result<usize> {
    let cutoff = chrono::Utc::now().timestamp_millis() - max_age_ms;
    let n = conn.execute(
        "DELETE FROM chat_sessions WHERE is_saved = 0 AND last_active_at < ?1",
        params![cutoff],
    )?;
    Ok(n)
}

/// Lookup the `generation_id` (audio file pointer) for a given message id.
/// Returns None if message has no audio or doesn't exist.
pub fn message_generation_id(
    conn: &Connection,
    message_id: &str,
) -> Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT generation_id FROM chat_messages WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![message_id])?;
    if let Some(row) = rows.next()? {
        Ok(row.get(0)?)
    } else {
        Ok(None)
    }
}
