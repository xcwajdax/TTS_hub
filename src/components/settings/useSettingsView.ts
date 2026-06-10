import { useCallback, useEffect, useRef, useState } from "react";
import { getAppSettings, setAppSettings } from "../../api/tauri";
import {
  appSettingsViewToPayload,
  defaultEditorQuickGenSettings,
  defaultQuickHotkeysSettings,
  defaultTextFiltersSettings,
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_TEMP_HISTORY_MAX,
  type AppSettingsView,
} from "../../appSettings";
import { isTauriApp } from "../../lib/tauriEnv";
import { syncSaveFormatFromSettings } from "../../audioFormats";

export type HistoryPrefs = {
  history_click_to_play: boolean;
  history_compact_view: boolean;
};

export type SettingsView = AppSettingsView & HistoryPrefs;

export type SettingsUpdater = <K extends keyof SettingsView>(
  key: K,
  value: SettingsView[K],
) => void;

const AUTOSAVE_DEBOUNCE_MS = 350;

export interface UseSettingsViewOptions {
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export interface UseSettingsViewResult {
  view: SettingsView | null;
  update: SettingsUpdater;
  patch: (patch: Partial<SettingsView>) => void;
  flushSave: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useSettingsView({
  onError,
  onSuccess,
}: UseSettingsViewOptions): UseSettingsViewResult {
  const [view, setView] = useState<SettingsView | null>(null);
  const pendingRef = useRef<Partial<SettingsView>>({});
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    if (!isTauriApp()) return;
    try {
      const v = await getAppSettings();
      setView({
        ...v,
        history_click_to_play: loadClickToPlay(),
        history_compact_view: loadCompactView(),
      });
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const flushSave = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0 || !view || savingRef.current) return;
    const snapshot = pending;
    pendingRef.current = {};
    savingRef.current = true;
    try {
      const historyPatch: Partial<SettingsView> = {};
      if ("history_click_to_play" in snapshot) {
        saveClickToPlay(!!snapshot.history_click_to_play);
        historyPatch.history_click_to_play = snapshot.history_click_to_play;
      }
      if ("history_compact_view" in snapshot) {
        saveCompactView(!!snapshot.history_compact_view);
        historyPatch.history_compact_view = snapshot.history_compact_view;
      }
      const appKeys = Object.fromEntries(
        Object.entries(snapshot).filter(([k]) => !k.startsWith("history_") && !k.startsWith("effective_") && !k.startsWith("env_")),
      );
      let nextView = view;
      if (Object.keys(appKeys).length > 0) {
        const payload = appSettingsViewToPayload({
          ...view,
          ...appKeys,
          ...historyPatch,
        } as AppSettingsView);
        const fresh = await setAppSettings(payload);
        nextView = {
          ...fresh,
          history_click_to_play: view.history_click_to_play,
          history_compact_view: view.history_compact_view,
        };
        void syncSaveFormatFromSettings();
        onSuccess?.("Zapisano ustawienie");
      }
      setView(nextView);
    } catch (e) {
      onError(String(e));
    } finally {
      savingRef.current = false;
    }
  }, [view, onError, onSuccess]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const update: SettingsUpdater = useCallback(
    (key, value) => {
      setView((prev) => {
        if (!prev) return prev;
        return { ...prev, [key]: value };
      });
      pendingRef.current = { ...pendingRef.current, [key]: value };
      scheduleSave();
    },
    [scheduleSave],
  );

  const patch = useCallback(
    (p: Partial<SettingsView>) => {
      setView((prev) => (prev ? { ...prev, ...p } : prev));
      pendingRef.current = { ...pendingRef.current, ...p };
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(() => {
    const onUnload = () => {
      if (Object.keys(pendingRef.current).length > 0) {
        void flushSave();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushSave]);

  return { view, update, patch, flushSave, reload: load };
}

const CLICK_TO_PLAY_KEY = "tts-hub-history-click-to-play";
const COMPACT_VIEW_KEY = "tts-hub-history-compact-view";

function loadClickToPlay(): boolean {
  try {
    return localStorage.getItem(CLICK_TO_PLAY_KEY) === "1";
  } catch {
    return false;
  }
}

function saveClickToPlay(v: boolean) {
  try {
    localStorage.setItem(CLICK_TO_PLAY_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function loadCompactView(): boolean {
  try {
    return localStorage.getItem(COMPACT_VIEW_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCompactView(v: boolean) {
  try {
    localStorage.setItem(COMPACT_VIEW_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const SETTINGS_DEFAULTS = {
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_TEMP_HISTORY_MAX,
  defaultEditorQuickGenSettings,
  defaultQuickHotkeysSettings,
  defaultTextFiltersSettings,
};
