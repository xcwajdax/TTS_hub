// Local per-provider usage counter.
//
// Important: this counts **what went through TTShub** — it is NOT a window into
// the MiniMax / Google / VoiceBox accounts. The MiniMax API does not expose
// any quota or pool endpoint (see minimax.rs lines 17-47 for the verification).
// `last_24h_*` is a 24-hour rolling window over the local `generations` table.
//
// Aggregation is straightforward SQL:
//   SUM(char_count), SUM(estimated_tokens), COUNT(*)
// filtered by `created_at >= now - 86400` for the 24h window.
//
// char_count and estimated_tokens are populated at enqueue time in
// `commands::enqueue_request`. estimated_tokens = (char_count + 2) / 3,
// which is the MiniMax rule of thumb for Polish text (≈3 chars/token).

use anyhow::Result;
use rusqlite::params;
use serde::Serialize;

/// Per-provider rollup of generations, character count, and estimated tokens.
#[derive(Debug, Clone, Serialize)]
pub struct ProviderUsage {
    pub provider: String,
    pub total_chars: i64,
    pub total_tokens_est: i64,
    pub total_generations: i64,
    pub last_24h_chars: i64,
    pub last_24h_generations: i64,
    /// `now` parameter echoed back so HTTP clients can reason about staleness.
    pub as_of: i64,
}

impl ProviderUsage {
    fn empty(provider: impl Into<String>, now: i64) -> Self {
        Self {
            provider: provider.into(),
            total_chars: 0,
            total_tokens_est: 0,
            total_generations: 0,
            last_24h_chars: 0,
            last_24h_generations: 0,
            as_of: now,
        }
    }
}

/// Roll up one provider. `now` is a unix timestamp in **seconds**.
pub fn compute_usage(db: &crate::db::Db, provider: &str, now: i64) -> Result<ProviderUsage> {
    let c = db.conn();
    let p = provider.trim().to_ascii_lowercase();
    if p.is_empty() {
        return Ok(ProviderUsage::empty(provider, now));
    }
    let cutoff_24h = now - 86_400;

    let (total_chars, total_tokens, total_gens): (i64, i64, i64) = c
        .query_row(
            "SELECT COALESCE(SUM(char_count), 0),
                    COALESCE(SUM(estimated_tokens), 0),
                    COUNT(*)
             FROM generations
             WHERE provider = ?1",
            params![p],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

    let (h24_chars, h24_gens): (i64, i64) = c
        .query_row(
            "SELECT COALESCE(SUM(char_count), 0), COUNT(*)
             FROM generations
             WHERE provider = ?1 AND created_at >= ?2",
            params![p, cutoff_24h * 1000],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

    Ok(ProviderUsage {
        provider: p,
        total_chars,
        total_tokens_est: total_tokens,
        total_generations: total_gens,
        last_24h_chars: h24_chars,
        last_24h_generations: h24_gens,
        as_of: now,
    })
}

/// Roll up all providers that appear in the `generations` table. Returns one
/// `ProviderUsage` per distinct provider value (not per `ALL_PROVIDERS` — that
/// is the responsibility of the HTTP layer, which can overlay an "enabled but
/// never used" set on top of this).
pub fn compute_all_providers(db: &crate::db::Db, now: i64) -> Result<Vec<ProviderUsage>> {
    let c = db.conn();
    let cutoff_24h_ms = (now - 86_400) * 1000;

    // One pass: aggregate per provider in a single SQL. NULL provider is
    // treated as its own bucket ("(unset)") for back-compat with rows
    // inserted before the provider column existed.
    let mut stmt = c.prepare(
        "SELECT COALESCE(provider, '(unset)') AS p,
                COALESCE(SUM(char_count), 0),
                COALESCE(SUM(estimated_tokens), 0),
                COUNT(*),
                COALESCE(SUM(CASE WHEN created_at >= ?1 THEN char_count ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END), 0)
         FROM generations
         GROUP BY COALESCE(provider, '(unset)')
         ORDER BY p ASC",
    )?;

    let rows = stmt.query_map(params![cutoff_24h_ms], |row| {
        Ok(ProviderUsage {
            provider: row.get(0)?,
            total_chars: row.get(1)?,
            total_tokens_est: row.get(2)?,
            total_generations: row.get(3)?,
            last_24h_chars: row.get(4)?,
            last_24h_generations: row.get(5)?,
            as_of: now,
        })
    })?;

    let mut out: Vec<ProviderUsage> = rows.filter_map(|r| r.ok()).collect();
    // Defensive: drop the synthetic "(unset)" bucket if it has zero rows
    // (the GROUP BY would still emit it, but a fresh DB never has any rows).
    out.retain(|u| u.total_generations > 0 || u.provider != "(unset)");
    Ok(out)
}

/// Format `tokens` as a compact "4.1k" / "1.2M" badge string for the UI.
#[cfg(test)]
pub fn format_token_badge(tokens: i64) -> String {
    let abs = tokens.unsigned_abs() as f64;
    if abs >= 1_000_000.0 {
        format!("{:.1}M", tokens as f64 / 1_000_000.0)
    } else if abs >= 1_000.0 {
        format!("{:.1}k", tokens as f64 / 1_000.0)
    } else {
        tokens.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_token_badge_smoke() {
        assert_eq!(format_token_badge(0), "0");
        assert_eq!(format_token_badge(999), "999");
        assert_eq!(format_token_badge(1_000), "1.0k");
        assert_eq!(format_token_badge(4_150), "4.2k");
        assert_eq!(format_token_badge(1_234_567), "1.2M");
    }

    #[test]
    fn empty_provider_is_all_zero() {
        // We don't have a real DB here; just check the struct helper.
        let u = ProviderUsage::empty("google", 1_780_000_000);
        assert_eq!(u.total_chars, 0);
        assert_eq!(u.total_generations, 0);
        assert_eq!(u.provider, "google");
    }
}
