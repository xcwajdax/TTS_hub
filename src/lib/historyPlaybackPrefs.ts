const CLICK_TO_PLAY_KEY = "tts-hub.history.clickToPlay";

export const HISTORY_PREFS_CHANGED = "tts-hub-history-prefs-changed";

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
    window.dispatchEvent(new CustomEvent(HISTORY_PREFS_CHANGED));
  } catch {
    /* ignore */
  }
}
