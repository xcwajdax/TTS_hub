import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Phase =
  | "idle"
  | "preparing"
  | "requesting"
  | "decoding"
  | "writing"
  | "done";

export const PHASE_LABEL: Record<Phase, string> = {
  idle: "Bezczynny",
  preparing: "Przygotowuję request...",
  requesting: "Czekam na Google...",
  decoding: "Dekoduję audio...",
  writing: "Zapisuję plik...",
  done: "Gotowe",
};

interface PhasePayload {
  phase: Exclude<Phase, "idle">;
  elapsed_ms: number;
}

interface Sample {
  chars: number;
  latency: number;
}

const SAMPLES_KEY = "tts-hub.latency-samples.v1";
const MAX_SAMPLES = 50;
const FALLBACK_MS_PER_CHAR = 35;
const FALLBACK_BASE_MS = 1500;

function loadSamples(): Sample[] {
  try {
    const raw = localStorage.getItem(SAMPLES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (s) =>
        s &&
        typeof s.chars === "number" &&
        typeof s.latency === "number" &&
        s.chars > 0 &&
        s.latency > 0,
    );
  } catch {
    return [];
  }
}

function saveSamples(samples: Sample[]) {
  try {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples.slice(-MAX_SAMPLES)));
  } catch {
    // ignore quota errors
  }
}

/** Linear estimate: latency ≈ base + msPerChar * chars, computed from samples. */
function estimateEta(samples: Sample[], chars: number): number {
  if (chars <= 0) return FALLBACK_BASE_MS;
  if (samples.length === 0) {
    return FALLBACK_BASE_MS + FALLBACK_MS_PER_CHAR * chars;
  }
  // Simple average of per-sample ms/char; robust enough for small N.
  const msPerChar =
    samples.reduce((acc, s) => acc + s.latency / Math.max(1, s.chars), 0) /
    samples.length;
  const base =
    samples.reduce((acc, s) => acc + Math.max(0, s.latency - msPerChar * s.chars), 0) /
    samples.length;
  return Math.max(500, base + msPerChar * chars);
}

export interface GenerationProgress {
  active: boolean;
  phase: Phase;
  elapsedMs: number;
  etaMs: number;
  /** 0..1, clamped */
  progress: number;
  start: (chars: number) => void;
  finish: (success: boolean) => void;
}

export function useGenerationProgress(): GenerationProgress {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [etaMs, setEtaMs] = useState(0);

  const startedAtRef = useRef<number>(0);
  const charsRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    listen<PhasePayload>("generation:phase", (e) => {
      if (cancelled) return;
      setPhase(e.payload.phase);
    })
      .then((u) => {
        if (cancelled) {
          u();
        } else {
          unlisten = u;
        }
      })
      .catch(() => {
        // listen may fail outside Tauri (e.g. plain vite dev); ignore.
      });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const stopTicker = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const clearDoneTimer = useCallback(() => {
    if (doneTimerRef.current !== null) {
      window.clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
  }, []);

  const start = useCallback((chars: number) => {
    clearDoneTimer();
    const samples = loadSamples();
    charsRef.current = chars;
    startedAtRef.current = performance.now();
    setActive(true);
    setPhase("preparing");
    setElapsedMs(0);
    setEtaMs(estimateEta(samples, chars));
    stopTicker();
    tickRef.current = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 100);
  }, [stopTicker, clearDoneTimer]);

  const finish = useCallback((success: boolean) => {
    stopTicker();
    clearDoneTimer();
    const latency = performance.now() - startedAtRef.current;
    setElapsedMs(latency);
    setActive(false);
    setPhase(success ? "done" : "idle");
    if (success) {
      doneTimerRef.current = window.setTimeout(() => {
        doneTimerRef.current = null;
        setPhase("idle");
      }, 1600);
    }
    if (success && charsRef.current > 0 && latency > 0) {
      const samples = loadSamples();
      samples.push({ chars: charsRef.current, latency });
      saveSamples(samples);
    }
  }, [stopTicker, clearDoneTimer]);

  useEffect(
    () => () => {
      stopTicker();
      clearDoneTimer();
    },
    [stopTicker, clearDoneTimer],
  );

  const progress = active && etaMs > 0
    ? Math.min(0.99, elapsedMs / etaMs)
    : phase === "done"
      ? 1
      : 0;

  return { active, phase, elapsedMs, etaMs, progress, start, finish };
}
