import type { HistoryGroupingMode, HistoryScopeTab } from "./historyToolbar";
import type { ProfileFilterId } from "./historyProfileGroups";

const CLICK_TO_PLAY_KEY = "tts-hub.history.clickToPlay";
const COMPACT_VIEW_KEY = "tts-hub.history.compactView";
const SCOPE_TAB_KEY = "tts-hub.history.scopeTab";
const GROUPING_MODE_KEY = "tts-hub.history.groupingMode";
const PROFILE_FILTER_KEY = "tts-hub.history.profileFilter";
const JOBS_PANEL_COLLAPSED_KEY = "tts-hub.history.jobsPanelCollapsed";
const SOURCE_FILTER_EXPANDED_KEY = "tts-hub.history.sourceFilterExpanded";

export const HISTORY_PREFS_CHANGED = "tts-hub-history-prefs-changed";

function dispatchPrefsChanged() {
  window.dispatchEvent(new CustomEvent(HISTORY_PREFS_CHANGED));
}

export function loadHistoryClickToPlay(): boolean {
  try {
    const s = localStorage.getItem(CLICK_TO_PLAY_KEY);
    if (s === "false") return false;
    if (s === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveHistoryClickToPlay(enabled: boolean): void {
  try {
    localStorage.setItem(CLICK_TO_PLAY_KEY, enabled ? "true" : "false");
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function loadHistoryCompactView(): boolean {
  try {
    return localStorage.getItem(COMPACT_VIEW_KEY) === "true";
  } catch {
    return false;
  }
}

export function loadHistoryScopeTab(): HistoryScopeTab | null {
  try {
    const s = localStorage.getItem(SCOPE_TAB_KEY);
    if (
      s === "session" ||
      s === "archive" ||
      s === "cursor" ||
      s === "bots" ||
      s === "soundboard"
    ) {
      return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveHistoryScopeTab(tab: HistoryScopeTab): void {
  try {
    localStorage.setItem(SCOPE_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

export function saveHistoryCompactView(enabled: boolean): void {
  try {
    localStorage.setItem(COMPACT_VIEW_KEY, enabled ? "true" : "false");
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function loadHistoryGroupingMode(): HistoryGroupingMode {
  try {
    const s = localStorage.getItem(GROUPING_MODE_KEY);
    if (s === "profile" || s === "date") return s;
  } catch {
    /* ignore */
  }
  return "date";
}

export function saveHistoryGroupingMode(mode: HistoryGroupingMode): void {
  try {
    localStorage.setItem(GROUPING_MODE_KEY, mode);
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function loadHistoryProfileFilter(): ProfileFilterId {
  try {
    const s = localStorage.getItem(PROFILE_FILTER_KEY);
    if (s === "__all__" || s === "__none__" || (s && s.length > 0)) return s;
  } catch {
    /* ignore */
  }
  return "__all__";
}

export function saveHistoryProfileFilter(filter: ProfileFilterId): void {
  try {
    localStorage.setItem(PROFILE_FILTER_KEY, filter);
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function loadJobsPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(JOBS_PANEL_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveJobsPanelCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(JOBS_PANEL_COLLAPSED_KEY, collapsed ? "true" : "false");
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}

export function loadSourceFilterExpanded(): boolean {
  try {
    return localStorage.getItem(SOURCE_FILTER_EXPANDED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSourceFilterExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(SOURCE_FILTER_EXPANDED_KEY, expanded ? "true" : "false");
    dispatchPrefsChanged();
  } catch {
    /* ignore */
  }
}
