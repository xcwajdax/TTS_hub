import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { cyclePrivacyMode, getAppSettings } from "../api/tauri";
import {
  normalizePrivacyMode,
  privacyModeTitle,
  setPrivacyModeSnapshot,
  type PrivacyMode,
} from "../lib/privacyMode";
import { isTauriApp } from "../lib/tauriEnv";

function PrivacyIcon({ mode }: { mode: PrivacyMode }) {
  if (mode === "private") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden className="title-bar__privacy-icon">
        <path
          fill="currentColor"
          d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8Z"
        />
      </svg>
    );
  }

  if (mode === "incognito") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden className="title-bar__privacy-icon">
        <path
          fill="currentColor"
          d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
          opacity="0.9"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          d="M4 4l16 16"
        />
      </svg>
    );
  }

  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden className="title-bar__privacy-icon">
      <path
        fill="currentColor"
        d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Z"
        opacity="0.38"
      />
    </svg>
  );
}

interface Props {
  onModeChange?: (mode: PrivacyMode) => void;
}

export default function TitleBarPrivacyToggle({ onModeChange }: Props) {
  const [mode, setMode] = useState<PrivacyMode>("normal");
  const [busy, setBusy] = useState(false);

  const applyMode = useCallback(
    (next: PrivacyMode) => {
      setMode(next);
      setPrivacyModeSnapshot(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    void getAppSettings()
      .then((view) => {
        if (cancelled) return;
        applyMode(normalizePrivacyMode(view.privacy_mode));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyMode]);

  useEffect(() => {
    if (!isTauriApp()) return;
    let unlistenPrivacy: (() => void) | undefined;
    void listen<string>("privacy_mode:changed", (e) => {
      applyMode(normalizePrivacyMode(e.payload));
    }).then((fn) => {
      unlistenPrivacy = fn;
    });
    return () => {
      unlistenPrivacy?.();
    };
  }, [applyMode]);

  const cycle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = normalizePrivacyMode(await cyclePrivacyMode());
      applyMode(next);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  if (!isTauriApp()) return null;

  const title = privacyModeTitle(mode);
  const active = mode !== "normal";

  return (
    <button
      type="button"
      className={`title-bar__privacy chrome-field chrome-field--lock title-bar__privacy--${mode} ${active ? "title-bar__privacy--on" : ""}`}
      onClick={() => void cycle()}
      disabled={busy}
      aria-label={title}
      title={title}
      data-privacy-mode={mode}
      aria-pressed={active}
    >
      <PrivacyIcon mode={mode} />
    </button>
  );
}
