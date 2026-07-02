use std::collections::HashMap;
use std::sync::Mutex;

use crate::db::{Generation, GenerationUsage, STATUS_DONE, STATUS_QUEUED, STATUS_RUNNING};

/// In-memory generations for incognito mode (never written to SQLite).
pub struct EphemeralStore {
    generations: Mutex<HashMap<String, Generation>>,
}

impl EphemeralStore {
    pub fn new() -> Self {
        Self {
            generations: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert(&self, g: Generation) {
        if let Ok(mut map) = self.generations.lock() {
            map.insert(g.id.clone(), g);
        }
    }

    pub fn get(&self, id: &str) -> Option<Generation> {
        self.generations
            .lock()
            .ok()
            .and_then(|map| map.get(id).cloned())
    }

    pub fn contains(&self, id: &str) -> bool {
        self.generations
            .lock()
            .ok()
            .is_some_and(|map| map.contains_key(id))
    }

    pub fn list_by_statuses(&self, statuses: &[&str]) -> Vec<Generation> {
        let Ok(map) = self.generations.lock() else {
            return Vec::new();
        };
        map.values()
            .filter(|g| statuses.contains(&g.status.as_str()))
            .cloned()
            .collect()
    }

    pub fn mark_running(&self, id: &str) -> bool {
        let Ok(mut map) = self.generations.lock() else {
            return false;
        };
        let Some(g) = map.get_mut(id) else {
            return false;
        };
        g.status = STATUS_RUNNING.to_string();
        g.attempts += 1;
        g.updated_at = chrono::Utc::now().timestamp_millis();
        true
    }

    pub fn mark_queued(&self, id: &str) -> bool {
        let Ok(mut map) = self.generations.lock() else {
            return false;
        };
        let Some(g) = map.get_mut(id) else {
            return false;
        };
        g.status = STATUS_QUEUED.to_string();
        g.error = None;
        g.updated_at = chrono::Utc::now().timestamp_millis();
        true
    }

    pub fn update_status(&self, id: &str, status: &str, error: Option<&str>) -> bool {
        let Ok(mut map) = self.generations.lock() else {
            return false;
        };
        let Some(g) = map.get_mut(id) else {
            return false;
        };
        g.status = status.to_string();
        g.error = error.map(|s| s.to_string());
        g.updated_at = chrono::Utc::now().timestamp_millis();
        true
    }

    pub fn finalize_done(
        &self,
        id: &str,
        file_path: &str,
        format: &str,
        duration_ms: Option<i64>,
        title: Option<&str>,
        usage: Option<&GenerationUsage>,
    ) -> Option<Generation> {
        let Ok(mut map) = self.generations.lock() else {
            return None;
        };
        let Some(g) = map.get_mut(id) else {
            return None;
        };
        g.status = STATUS_DONE.to_string();
        g.file_path = file_path.to_string();
        g.format = format.to_string();
        g.duration_ms = duration_ms;
        if let Some(t) = title {
            g.title = Some(t.to_string());
        }
        g.error = None;
        g.updated_at = chrono::Utc::now().timestamp_millis();
        if let Some(u) = usage {
            g.provider = u.provider.clone();
            g.input_chars = u.input_chars;
            g.prompt_tokens = u.prompt_tokens;
            g.output_tokens = u.output_tokens;
            g.total_tokens = u.total_tokens;
        }
        Some(g.clone())
    }

    /// Remove all ephemeral rows; returns file paths that callers should delete from disk.
    pub fn purge(&self) -> Vec<String> {
        let Ok(mut map) = self.generations.lock() else {
            return Vec::new();
        };
        let paths: Vec<String> = map
            .values()
            .filter_map(|g| {
                let p = g.file_path.trim();
                if p.is_empty() {
                    None
                } else {
                    Some(p.to_string())
                }
            })
            .collect();
        map.clear();
        paths
    }

    pub fn remove(&self, id: &str) -> Option<Generation> {
        self.generations.lock().ok()?.remove(id)
    }

    pub fn mark_cancelled(&self, id: &str) -> Option<Generation> {
        let Ok(mut map) = self.generations.lock() else {
            return None;
        };
        let g = map.remove(id)?;
        Some(g)
    }
}

impl Default for EphemeralStore {
    fn default() -> Self {
        Self::new()
    }
}
