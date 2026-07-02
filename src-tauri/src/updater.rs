use once_cell::sync::Lazy;
use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};

const GITHUB_RELEASES_URL: &str =
    "https://api.github.com/repos/xcwajdax/TTS_hub/releases?per_page=5";
const HTTP_TIMEOUT_SECS: u64 = 10;
const CACHE_TTL: Duration = Duration::from_secs(15 * 60);

static UPDATE_CACHE: Lazy<Mutex<Option<CachedUpdate>>> = Lazy::new(|| Mutex::new(None));

#[derive(Debug, Clone)]
struct CachedUpdate {
    fetched_at: Instant,
    result: UpdateCheckResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateCheckStatus {
    UpToDate,
    UpdateAvailable,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct UpdateChangelogSections {
    pub whats_new: Vec<String>,
    pub fixed: Vec<String>,
    pub other: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateCheckResult {
    pub status: UpdateCheckStatus,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub published_at: Option<String>,
    pub release_page_url: Option<String>,
    pub download_url: Option<String>,
    pub sections: UpdateChangelogSections,
    pub total_change_count: usize,
    pub error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    body: Option<String>,
    draft: bool,
    published_at: Option<String>,
    html_url: String,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

#[tauri::command]
pub async fn check_for_updates(force: Option<bool>) -> UpdateCheckResult {
    let force = force.unwrap_or(false);
    check_for_updates_inner(force).await
}

pub async fn check_for_updates_inner(force: bool) -> UpdateCheckResult {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    if !force {
        if let Some(cached) = read_cache() {
            return cached;
        }
    }

    let result = match fetch_update_check(&current_version).await {
        Ok(result) => result,
        Err(message) => UpdateCheckResult {
            status: UpdateCheckStatus::Error,
            current_version,
            latest_version: None,
            published_at: None,
            release_page_url: None,
            download_url: None,
            sections: UpdateChangelogSections::default(),
            total_change_count: 0,
            error_message: Some(message),
        },
    };

    write_cache(result.clone());
    result
}

fn read_cache() -> Option<UpdateCheckResult> {
    let guard = UPDATE_CACHE.lock().ok()?;
    let cached = guard.as_ref()?;
    if cached.fetched_at.elapsed() < CACHE_TTL {
        Some(cached.result.clone())
    } else {
        None
    }
}

fn write_cache(result: UpdateCheckResult) {
    if let Ok(mut guard) = UPDATE_CACHE.lock() {
        *guard = Some(CachedUpdate {
            fetched_at: Instant::now(),
            result,
        });
    }
}

async fn fetch_update_check(current_version: &str) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Nie udało się utworzyć klienta HTTP: {e}"))?;

    let user_agent = format!("TTS-Hub/{current_version}");
    let response = client
        .get(GITHUB_RELEASES_URL)
        .header(USER_AGENT, user_agent)
        .send()
        .await
        .map_err(|e| format!("Błąd połączenia z GitHub: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API zwróciło status {}",
            response.status()
        ));
    }

    let releases: Vec<GhRelease> = response
        .json()
        .await
        .map_err(|e| format!("Nie udało się odczytać odpowiedzi GitHub: {e}"))?;

    parse_version(current_version)
        .ok_or_else(|| format!("Nieprawidłowa wersja aplikacji: {current_version}"))?;

    let latest_release = releases
        .into_iter()
        .find(|release| !release.draft && parse_tag_version(&release.tag_name).is_some());

    let Some(latest_release) = latest_release else {
        return Ok(up_to_date_result(current_version));
    };

    let latest_version = parse_tag_version(&latest_release.tag_name)
        .ok_or_else(|| format!("Nieprawidłowy tag release: {}", latest_release.tag_name))?;

    if !is_version_newer(&latest_version, current_version) {
        return Ok(up_to_date_result(current_version));
    }

    let sections = parse_changelog_sections(latest_release.body.as_deref().unwrap_or_default());
    let total_change_count = sections.whats_new.len()
        + sections.fixed.len()
        + sections.other.len();

    Ok(UpdateCheckResult {
        status: UpdateCheckStatus::UpdateAvailable,
        current_version: current_version.to_string(),
        latest_version: Some(latest_version),
        published_at: latest_release.published_at,
        release_page_url: Some(latest_release.html_url),
        download_url: pick_nsis_download_url(&latest_release.assets),
        sections,
        total_change_count,
        error_message: None,
    })
}

fn up_to_date_result(current_version: &str) -> UpdateCheckResult {
    UpdateCheckResult {
        status: UpdateCheckStatus::UpToDate,
        current_version: current_version.to_string(),
        latest_version: None,
        published_at: None,
        release_page_url: None,
        download_url: None,
        sections: UpdateChangelogSections::default(),
        total_change_count: 0,
        error_message: None,
    }
}

fn parse_tag_version(tag_name: &str) -> Option<String> {
    let trimmed = tag_name.trim().trim_start_matches('v').trim();
    parse_version(trimmed).map(|version| version.to_string())
}

fn parse_version(raw: &str) -> Option<semver::Version> {
    semver::Version::parse(raw.trim().trim_start_matches('v')).ok()
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

fn pick_nsis_download_url(assets: &[GhAsset]) -> Option<String> {
    assets
        .iter()
        .find(|asset| {
            let name = asset.name.to_ascii_lowercase();
            name.contains("x64-setup") || name.ends_with("_setup.exe")
        })
        .or_else(|| {
            assets.iter().find(|asset| {
                asset.name.to_ascii_lowercase().ends_with(".exe")
            })
        })
        .map(|asset| asset.browser_download_url.clone())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChangelogSection {
    WhatsNew,
    Fixed,
    Other,
}

fn parse_changelog_sections(body: &str) -> UpdateChangelogSections {
    let mut sections = UpdateChangelogSections::default();
    let mut current = None;

    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(heading) = trimmed.strip_prefix("### ") {
            current = Some(map_heading_to_section(heading));
            continue;
        }

        let Some(section) = current else {
            continue;
        };

        let item = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
            .map(str::trim)
            .filter(|value| !value.is_empty());

        let Some(item) = item else {
            continue;
        };

        match section {
            ChangelogSection::WhatsNew => sections.whats_new.push(item.to_string()),
            ChangelogSection::Fixed => sections.fixed.push(item.to_string()),
            ChangelogSection::Other => sections.other.push(item.to_string()),
        }
    }

    sections
}

fn map_heading_to_section(heading: &str) -> ChangelogSection {
    let normalized = heading.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "added" | "changed" | "new" | "co nowego" | "what's new" | "whats new" => {
            ChangelogSection::WhatsNew
        }
        "fixed" | "poprawki" | "fixes" => ChangelogSection::Fixed,
        _ => ChangelogSection::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_version_strips_v_prefix() {
        let version = parse_version("v0.2.0").expect("version");
        assert_eq!(version.to_string(), "0.2.0");
    }

    #[test]
    fn is_version_newer_compares_semver() {
        assert!(is_version_newer("0.2.0", "0.1.0"));
        assert!(!is_version_newer("0.1.0", "0.1.0"));
        assert!(!is_version_newer("0.1.0", "0.2.0"));
    }

    #[test]
    fn pick_nsis_download_url_prefers_setup_exe() {
        let assets = vec![
            GhAsset {
                name: "TTS.Hub_0.2.0_x64_en-US.msi".to_string(),
                browser_download_url: "https://example.com/app.msi".to_string(),
            },
            GhAsset {
                name: "TTS.Hub_0.2.0_x64-setup.exe".to_string(),
                browser_download_url: "https://example.com/app-setup.exe".to_string(),
            },
        ];

        assert_eq!(
            pick_nsis_download_url(&assets).as_deref(),
            Some("https://example.com/app-setup.exe")
        );
    }

    #[test]
    fn parse_changelog_sections_maps_headings() {
        let body = r#"### Added
- Feature A

### Changed
- Feature B

### Fixed
- Bug C

### Security
- Patch D
"#;

        let sections = parse_changelog_sections(body);
        assert_eq!(sections.whats_new, vec!["Feature A", "Feature B"]);
        assert_eq!(sections.fixed, vec!["Bug C"]);
        assert_eq!(sections.other, vec!["Patch D"]);
    }

    #[test]
    fn parse_changelog_sections_ignores_lines_without_heading() {
        let body = "- Orphan item";
        let sections = parse_changelog_sections(body);
        assert!(sections.whats_new.is_empty());
        assert!(sections.fixed.is_empty());
        assert!(sections.other.is_empty());
    }
}
