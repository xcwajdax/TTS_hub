import { useCallback, useEffect, useRef, useState } from "react";
import MainPanel from "./components/MainPanel";
import PlaybackBar from "./components/PlaybackBar";
import HistorySidebar from "./components/HistorySidebar";
import RecoveryModal from "./components/RecoveryModal";
import { PlaybackProvider, usePlayback } from "./context/PlaybackContext";
import { JobsProvider, useJobs } from "./context/JobsContext";
import type { Generation } from "./types";
import { listHistory, listJobs } from "./api/tauri";
import { syncSaveFormatFromSettings } from "./audioFormats";
import { useCursorIntegration } from "./hooks/useCursorIntegration";

function AppInner() {
  const { current, playing, playNonce, select, audioRef } = usePlayback();
  const { onDone } = useJobs();
  const [session, setSession] = useState<Generation[]>([]);
  const [archive, setArchive] = useState<Generation[]>([]);
  const [interrupted, setInterrupted] = useState<Generation[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { cfg, lastCursor } = useCursorIntegration();
  const queueRef = useRef<Generation[]>([]);
  const lastCursorGenRef = useRef<Generation | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([listHistory("session"), listHistory("archive")]);
      setSession(s);
      setArchive(a);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refreshInterrupted = useCallback(async () => {
    try {
      const list = await listJobs("interrupted");
      setInterrupted(list);
      return list;
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  useEffect(() => {
    refresh();
    void syncSaveFormatFromSettings();
    void refreshInterrupted().then((list) => {
      if (list.length > 0) setShowRecovery(true);
    });
  }, [refresh, refreshInterrupted]);

  // When any job finishes, refresh history and auto-select the new row
  // (preserves the previous synchronous UX: "generate then immediately play").
  useEffect(() => {
    return onDone((g) => {
      void refresh();
      select(g);
    });
  }, [onDone, refresh, select]);

  useEffect(() => {
    if (!lastCursor) return;
    lastCursorGenRef.current = lastCursor;
    void refresh();
    if (cfg.autoplay) {
      // PlaybackQueue: if something is already playing from cursor, enqueue.
      // Manual current (source !== cursor) is preempted by cursor autoplay too.
      if (playing && current?.source === "cursor") {
        queueRef.current = [...queueRef.current, lastCursor];
        setToast(`Cursor (kolejka ${queueRef.current.length}): ${lastCursor.title ?? "podsumowanie"}`);
      } else {
        select(lastCursor);
        setToast(`Cursor: ${lastCursor.title ?? "podsumowanie"}`);
      }
    } else {
      setToast(`Cursor: ${lastCursor.title ?? "podsumowanie"}`);
    }
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [lastCursor, cfg.autoplay, refresh, select, playing, current?.source]);

  // PlaybackQueue: when current cursor playback finishes, dequeue next.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => {
      if (queueRef.current.length === 0) return;
      if (current?.source !== "cursor") return;
      const [next, ...rest] = queueRef.current;
      queueRef.current = rest;
      select(next);
    };
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, [audioRef, current?.source, select]);

  // Global shortcut Ctrl+Shift+P: replay last cursor summary.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        const g = lastCursorGenRef.current;
        if (g) {
          e.preventDefault();
          select(g);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const onGenerated = (g: Generation) => {
    select(g);
    refresh();
  };

  const handleRecoveryClose = useCallback(() => {
    setShowRecovery(false);
    void refreshInterrupted();
  }, [refreshInterrupted]);

  return (
    <div className="h-full w-full grid" style={{ gridTemplateColumns: "3fr 1fr" }}>
      <div className="grid border-r border-border" style={{ gridTemplateRows: "9fr 1fr" }}>
        <MainPanel onGenerated={onGenerated} onError={setError} />
        <PlaybackBar
          current={current}
          playNonce={playNonce}
          sessionIndex={current ? session.findIndex((g) => g.id === current.id) : -1}
          sessionTotal={session.length}
        />
      </div>
      <div className="min-w-0 overflow-hidden">
        <HistorySidebar
          session={session}
          archive={archive}
          interrupted={interrupted}
          currentId={current?.id ?? null}
          onPlay={select}
          onChanged={() => {
            void refresh();
            void refreshInterrupted();
          }}
          onError={setError}
        />
      </div>
      <RecoveryModal
        open={showRecovery}
        items={interrupted}
        onClose={handleRecoveryClose}
        onChanged={() => {
          void refreshInterrupted();
        }}
        onError={setError}
      />
      {error && (
        <div
          className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
          onClick={() => setError(null)}
          title="Kliknij aby zamknac"
        >
          {error}
        </div>
      )}
      {toast && (
        <div
          className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
          onClick={() => setToast(null)}
          title="Kliknij aby zamknac"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <PlaybackProvider>
      <JobsProvider>
        <AppInner />
      </JobsProvider>
    </PlaybackProvider>
  );
}
