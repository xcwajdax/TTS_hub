import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyGenerationMp4ToClipboard } from "../api/tauri";
import { promptExportGenerationMp4 } from "../lib/exportGenerationMp3";
import {
  subscribeMp4ExportProgress,
  type Mp4ExportProgress,
} from "../lib/mp4ExportProgress";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";

export type Mp4ExportPhase = "idle" | "starting" | "render" | "done" | "error";

export interface Mp4LogEntry {
  at: number;
  text: string;
  kind: "info" | "ok" | "warn" | "error";
}

export interface Mp4ExportState {
  phase: Mp4ExportPhase;
  percent: number;
  message: string;
  /** Remaining time in ms (backend ETA preferred, fallback to client estimate). */
  etaMs: number | null;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  log: Mp4LogEntry[];
  error: string | null;
  lastFilePath: string | null;
  lastAction: "copy" | "save" | null;
}

const INITIAL_STATE: Mp4ExportState = {
  phase: "idle",
  percent: 0,
  message: "",
  etaMs: null,
  startedAtMs: null,
  finishedAtMs: null,
  log: [],
  error: null,
  lastFilePath: null,
  lastAction: null,
};

/** Client-side ETA fallback: 3s overhead + 1.2× audio duration. */
function clientEtaMs(generation: Generation | null | undefined, percent: number): number | null {
  if (!generation) return null;
  const durationMs = generation.duration_ms ?? 0;
  const overheadMs = 3000;
  const renderMs = Math.round(durationMs * 1.2);
  const totalMs = overheadMs + renderMs;
  const p = Math.max(0.05, Math.min(0.98, percent));
  return Math.max(0, Math.round(totalMs * (1 - p)));
}

interface UseMp4ExportArgs {
  generation: Generation | null | undefined;
  voiceProfiles?: TtsVoiceProfile[];
  templateId: string | null;
}

export function useMp4Export({ generation, voiceProfiles = [], templateId }: UseMp4ExportArgs) {
  const [state, setState] = useState<Mp4ExportState>(INITIAL_STATE);
  const tickRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  const genId = generation?.id ?? null;

  // Reset state when generation changes.
  useEffect(() => {
    setState(INITIAL_STATE);
  }, [genId]);

  // Subscribe to backend progress events.
  //
  // Note: `listen()` is async and returns a Promise<unlisten>. The cleanup
  // of `useEffect`, however, runs synchronously. In React 18 StrictMode
  // (dev) the mount → cleanup → remount cycle happens before the Promise
  // resolves, so a naive `let unsub; ...; return () => unsub?.()` leaks
  // the first listener (cleanup runs while `unsub` is still undefined).
  // We use a `cancelled` flag that the Promise resolver checks: if the
  // effect has been torn down before the listener finished registering,
  // we unlisten immediately. This guarantees at most one listener per
  // `genId` is active regardless of StrictMode mount cycles.
  useEffect(() => {
    if (!genId) return;
    let cancelled = false;
    void subscribeMp4ExportProgress(genId, (p: Mp4ExportProgress) => {
      setState((prev) => {
        const startedAtMs = prev.startedAtMs ?? Date.now();
        const isStart = p.phase === "start" && prev.phase !== "starting";
        const text = p.message || prev.message;
        const lowerText = text.toLowerCase();
        const kind: Mp4LogEntry["kind"] = p.phase === "error"
          ? "error"
          : p.phase === "done"
            ? "ok"
            : lowerText.includes("błąd") || lowerText.includes("error")
              ? "warn"
              : "info";
        // Defensive dedupe: skip if a structurally-identical entry was
        // added in the last 300 ms. Two listeners firing on the same
        // event (or any future double-fire) would otherwise show as
        // duplicates in the log. Phase-boundary messages (start/done)
        // are exempt — they should always be visible exactly once.
        const now = Date.now();
        const last = prev.log[prev.log.length - 1];
        const isDuplicate =
          !isStart &&
          last != null &&
          last.text === text &&
          last.kind === kind &&
          now - last.at < 300;
        const log = isDuplicate
          ? prev.log
          : [...prev.log, { at: now, text, kind }].slice(-80);
        const isDone = p.phase === "done";
        const isErr = p.phase === "error";
        return {
          ...prev,
          phase: isStart
            ? "starting"
            : (p.phase as Mp4ExportPhase) === "render"
              ? "render"
              : isDone
                ? "done"
                : isErr
                  ? "error"
                  : prev.phase,
          percent: p.percent,
          message: text,
          etaMs: typeof p.etaMs === "number" && p.phase === "render" ? p.etaMs : prev.etaMs,
          startedAtMs,
          finishedAtMs: isDone || isErr ? Date.now() : prev.finishedAtMs,
          log,
          error: isErr ? text : prev.error,
        };
      });
    }).then((unlisten) => {
      if (cancelled) {
        // Effect was torn down before the listener finished registering.
        unlisten();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [genId]);

  // Tick once a second so client-side ETA refreshes while waiting for ffmpeg.
  useEffect(() => {
    if (state.phase !== "starting" && state.phase !== "render") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    tickRef.current = id;
    return () => {
      window.clearInterval(id);
      tickRef.current = null;
    };
  }, [state.phase]);

  const liveEtaMs = useMemo(() => {
    if (typeof state.etaMs === "number" && state.etaMs > 0) {
      // Backend ETA is best-effort; reduce slightly to account for IPC jitter.
      return state.etaMs;
    }
    // tick reference to satisfy eslint about deps.
    void tick;
    return clientEtaMs(generation, state.percent);
  }, [state.etaMs, state.percent, generation, tick]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const startCopy = useCallback(async () => {
    if (!generation) return;
    setState(() => ({
      ...INITIAL_STATE,
      phase: "starting",
      startedAtMs: Date.now(),
      log: [{ at: Date.now(), text: "Start: kopiuję MP4 do schowka…", kind: "info" }],
      lastAction: "copy",
    }));
    try {
      await copyGenerationMp4ToClipboard(generation.id, templateId);
    } catch (e) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: String(e),
        finishedAtMs: Date.now(),
        log: [
          ...prev.log,
          { at: Date.now(), text: `Błąd: ${String(e)}`, kind: "error" },
        ],
      }));
    }
  }, [generation, templateId]);

  const startSave = useCallback(async () => {
    if (!generation) return;
    setState(() => ({
      ...INITIAL_STATE,
      phase: "starting",
      startedAtMs: Date.now(),
      log: [{ at: Date.now(), text: "Start: zapisuję MP4 na dysk…", kind: "info" }],
      lastAction: "save",
    }));
    try {
      await promptExportGenerationMp4(generation, voiceProfiles, templateId);
    } catch (e) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: String(e),
        finishedAtMs: Date.now(),
        log: [
          ...prev.log,
          { at: Date.now(), text: `Błąd: ${String(e)}`, kind: "error" },
        ],
      }));
    }
  }, [generation, voiceProfiles, templateId]);

  return {
    state,
    liveEtaMs,
    startCopy,
    startSave,
    reset,
  };
}
