import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cancelJob } from "../api/tauri";
import { useJobs, type TrackedJob } from "../context/JobsContext";
import { isTauriApp } from "../lib/tauriEnv";
import { providerDisplayName } from "../lib/jobProgressUi";
import type { Generation } from "../types";
import JobProgressCard from "./JobProgressCard";
import ToastWindowPanel from "./toast/ToastWindowPanel";

interface CaptureState {
  presetId: string;
  presetName: string;
  startedAt: number;
}

interface Props {
  onError?: (message: string) => void;
  /** Osobne okno systemowe (always-on-top), nie overlay w main. */
  standalone?: boolean;
}

function ToastPanel({
  capture,
  captureElapsed,
  quickActive,
  doneFlash,
  onCancel,
}: {
  capture: CaptureState | null;
  captureElapsed: number;
  quickActive: TrackedJob[];
  doneFlash: TrackedJob | null;
  onCancel: (id: string) => void;
}) {
  const headerSuffix =
    quickActive.length > 0 ? ` (${quickActive.length})` : capture ? " (1)" : "";

  return (
    <ToastWindowPanel title={`Szybki TTS${headerSuffix}`}>
      <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto -m-0.5 p-0.5">
        {capture && (
          <JobProgressCard
            title={capture.presetName}
            subtitle="Kopiowanie zaznaczenia (Ctrl+C)"
            status="capturing"
            elapsedMs={captureElapsed}
            etaMs={1200}
          />
        )}
        {quickActive.map((job) => (
          <JobProgressCard
            key={job.id}
            title={job.title?.trim() || job.text.split("\n")[0] || "(bez tytułu)"}
            subtitle={providerDisplayName(job.provider)}
            status={job.status}
            phase={job.phase}
            provider={job.provider}
            elapsedMs={job.elapsedMs}
            etaMs={job.etaMs}
            error={job.error}
            onCancel={() => onCancel(job.id)}
          />
        ))}
        {doneFlash && quickActive.length === 0 && !capture && (
          <JobProgressCard
            title={doneFlash.title?.trim() || doneFlash.text.split("\n")[0] || "Gotowe"}
            subtitle={providerDisplayName(doneFlash.provider)}
            status="done"
            phase="done"
            provider={doneFlash.provider}
            elapsedMs={doneFlash.elapsedMs}
            etaMs={doneFlash.etaMs}
          />
        )}
      </div>
    </ToastWindowPanel>
  );
}

export default function QuickHotkeyToast({ onError, standalone = false }: Props) {
  const { activeJobs, trackEnqueued, dropJob, onDone } = useJobs();
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [doneFlash, setDoneFlash] = useState<TrackedJob | null>(null);
  const [tick, setTick] = useState(0);

  const quickActive = useMemo(
    () => activeJobs.filter((j) => j.source === "quick_hotkey"),
    [activeJobs],
  );

  const visible = capture !== null || quickActive.length > 0 || doneFlash !== null;

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!standalone || !isTauriApp()) return;
    if (!visible) {
      const t = window.setTimeout(() => {
        void invoke("hide_quick_hotkey_toast");
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [visible, standalone]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen<{ presetId: string; presetName: string }>("quick-hotkey:started", (e) => {
        setCapture({
          presetId: e.payload.presetId,
          presetName: e.payload.presetName,
          startedAt: performance.now(),
        });
        setDoneFlash(null);
      }),
    );

    unsubs.push(
      listen<Generation>("quick-hotkey:queued", (e) => {
        setCapture(null);
        trackEnqueued(e.payload);
      }),
    );

    unsubs.push(
      listen<{ presetId: string; message?: string }>("quick-hotkey:error", () => {
        setCapture(null);
        if (standalone) {
          window.setTimeout(() => void invoke("hide_quick_hotkey_toast"), 3500);
        }
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [trackEnqueued, standalone]);

  useEffect(() => {
    return onDone((g) => {
      if (g.source !== "quick_hotkey") return;
      setCapture(null);
      setDoneFlash({
        id: g.id,
        status: "done",
        phase: "done",
        chars: (g.text ?? "").length,
        startedAt: performance.now(),
        elapsedMs: 0,
        etaMs: 0,
        error: null,
        title: g.title,
        text: g.text,
        source: "quick_hotkey",
        provider: g.provider ?? null,
      });
      window.setTimeout(() => setDoneFlash(null), 2200);
    });
  }, [onDone]);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await cancelJob(id);
        dropJob(id);
      } catch (e) {
        onError?.(String(e));
      }
    },
    [dropJob, onError],
  );

  if (!isTauriApp()) return null;
  if (!standalone && !visible) return null;
  if (standalone && !visible) return null;

  void tick;

  const captureElapsed = capture ? performance.now() - capture.startedAt : 0;

  const panel = (
    <ToastPanel
      capture={capture}
      captureElapsed={captureElapsed}
      quickActive={quickActive}
      doneFlash={doneFlash}
      onCancel={(id) => void handleCancel(id)}
    />
  );

  if (standalone) {
    return (
      <div
        className="w-full min-h-0 p-1 box-border"
        role="status"
        aria-live="polite"
        aria-label="Postęp szybkiego TTS"
      >
        {panel}
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed top-3 right-3 z-[200] w-[min(100vw-1.5rem,22rem)]"
      role="status"
      aria-live="polite"
      aria-label="Postęp szybkiego TTS"
    >
      {panel}
    </div>,
    document.body,
  );
}
