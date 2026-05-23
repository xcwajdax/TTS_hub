import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAppSettings, setAppSettings } from "../api/tauri";
import {
  DEFAULT_TIMELINE_VIEW,
  normalizeTimelineViewMode,
  type TimelineViewMode,
} from "../lib/timelineView";
import { getSkinTimelineViewPreference } from "../skins/skinPreferences";
import type { SkinManifest } from "../skins/types";
import { isTauriApp } from "../lib/tauriEnv";

export const TIMELINE_VIEW_CHANGE_EVENT = "tts-hub-timeline-view-change";

interface TimelineViewContextValue {
  mode: TimelineViewMode;
  setMode: (mode: TimelineViewMode, options?: { persist?: boolean }) => Promise<void>;
  applySkinPreference: (manifest: Pick<SkinManifest, "preferences">) => void;
  loading: boolean;
}

const TimelineViewContext = createContext<TimelineViewContextValue | null>(null);

export function TimelineViewProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TimelineViewMode>(DEFAULT_TIMELINE_VIEW);
  const [loading, setLoading] = useState(true);

  const emitChange = useCallback((next: TimelineViewMode) => {
    window.dispatchEvent(
      new CustomEvent(TIMELINE_VIEW_CHANGE_EVENT, { detail: { mode: next } }),
    );
  }, []);

  const persistMode = useCallback(async (next: TimelineViewMode) => {
    if (!isTauriApp()) return;
    const view = await getAppSettings();
    await setAppSettings({ ...view, timeline_view: next });
  }, []);

  const setMode = useCallback(
    async (next: TimelineViewMode, options?: { persist?: boolean }) => {
      const normalized = normalizeTimelineViewMode(next);
      setModeState(normalized);
      emitChange(normalized);
      if (options?.persist !== false) {
        await persistMode(normalized);
      }
    },
    [emitChange, persistMode],
  );

  const applySkinPreference = useCallback(
    (manifest: Pick<SkinManifest, "preferences">) => {
      const pref = getSkinTimelineViewPreference(manifest);
      if (!pref) return;
      void setMode(pref, { persist: true });
    },
    [setMode],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isTauriApp()) {
          setModeState(DEFAULT_TIMELINE_VIEW);
          return;
        }
        const view = await getAppSettings();
        if (cancelled) return;
        setModeState(normalizeTimelineViewMode(view.timeline_view));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onSkin = () => {
      /* colors only — mode stays user setting unless skin switch applies preference */
    };
    window.addEventListener("tts-hub-skin-change", onSkin);
    return () => window.removeEventListener("tts-hub-skin-change", onSkin);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      applySkinPreference,
      loading,
    }),
    [mode, setMode, applySkinPreference, loading],
  );

  return (
    <TimelineViewContext.Provider value={value}>{children}</TimelineViewContext.Provider>
  );
}

export function useTimelineView(): TimelineViewContextValue {
  const ctx = useContext(TimelineViewContext);
  if (!ctx) throw new Error("useTimelineView must be used within TimelineViewProvider");
  return ctx;
}
