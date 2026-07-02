import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { getAppSettings, listJobs, setSafeMode } from "../api/tauri";
import { isTauriApp } from "../lib/tauriEnv";

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="title-bar__safe-mode-icon">
        <path
          fill="currentColor"
          d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-3 0h-4V7a2 2 0 1 1 4 0v2Z"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="title-bar__safe-mode-icon">
      <path
        fill="currentColor"
        d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-3 0h-4V7a2 2 0 1 1 4 0v2Z"
        opacity="0.45"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M8 11V7a4 4 0 1 1 8 0v4"
      />
    </svg>
  );
}

export default function TitleBarSafeModeToggle() {
  const [safeMode, setSafeModeState] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refreshPending = useCallback(async () => {
    if (!isTauriApp()) return;
    try {
      const list = await listJobs("pending_approval");
      setPendingCount(list.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    void getAppSettings()
      .then((view) => {
        if (!cancelled) setSafeModeState(!!view.safe_mode);
      })
      .catch(() => {});
    void refreshPending();
    return () => {
      cancelled = true;
    };
  }, [refreshPending]);

  useEffect(() => {
    if (!isTauriApp()) return;
    let unlistenSafe: (() => void) | undefined;
    let unlistenPending: (() => void) | undefined;
    void listen<boolean>("safe_mode:changed", (e) => {
      setSafeModeState(!!e.payload);
    }).then((fn) => {
      unlistenSafe = fn;
    });
    void listen("job:pending_approval", () => {
      void refreshPending();
    }).then((fn) => {
      unlistenPending = fn;
    });
    const onQueueChanged = () => void refreshPending();
    window.addEventListener("tts-hub.approval-queue.changed", onQueueChanged);
    return () => {
      unlistenSafe?.();
      unlistenPending?.();
      window.removeEventListener("tts-hub.approval-queue.changed", onQueueChanged);
    };
  }, [refreshPending]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await setSafeMode(!safeMode);
      setSafeModeState(next);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  if (!isTauriApp()) return null;

  const title = safeMode
    ? `Tryb bezpieczny — generacje wymagają zatwierdzenia${pendingCount > 0 ? ` (${pendingCount})` : ""}`
    : "Tryb bezpieczny — generacje od razu";

  return (
    <button
      type="button"
      className={`title-bar__safe-mode chrome-field chrome-field--lock ${safeMode ? "title-bar__safe-mode--on" : ""}`}
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={safeMode}
      aria-label={title}
      title={title}
    >
      <LockIcon locked={safeMode} />
      {pendingCount > 0 && (
        <span className="title-bar__safe-mode-badge" aria-hidden>
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </button>
  );
}
