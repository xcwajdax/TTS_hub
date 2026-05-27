import type { HistoryScopeTab } from "./historyToolbar";

const CLICK_TO_PLAY_KEY = "tts-hub.history.clickToPlay";
const COMPACT_VIEW_KEY = "tts-hub.history.compactView";
const SCOPE_TAB_KEY = "tts-hub.history.scopeTab";

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
    if (s === "session" || s === "archive" || s === "cursor" || s === "soundboard") {
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
