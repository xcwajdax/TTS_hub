import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriApp } from "../lib/tauriEnv";
import type { Generation, GenerationSource, JobStatus } from "../types";

export type Phase =
  | "idle"
  | "preparing"
  | "requesting"
  | "decoding"
  | "writing"
  | "done";

export const PHASE_LABEL: Record<Phase, string> = {
  idle: "Oczekuje",
  preparing: "Przygotowuję request...",
  requesting: "Czekam na Google...",
  decoding: "Dekoduję audio...",
  writing: "Zapisuję plik...",
  done: "Gotowe",
};

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
    // ignore quota
  }
}

function estimateEta(samples: Sample[], chars: number): number {
  if (chars <= 0) return FALLBACK_BASE_MS;
  if (samples.length === 0) {
    return FALLBACK_BASE_MS + FALLBACK_MS_PER_CHAR * chars;
  }
  const msPerChar =
    samples.reduce((acc, s) => acc + s.latency / Math.max(1, s.chars), 0) /
    samples.length;
  const base =
    samples.reduce((acc, s) => acc + Math.max(0, s.latency - msPerChar * s.chars), 0) /
    samples.length;
  return Math.max(500, base + msPerChar * chars);
}

export interface TrackedJob {
  id: string;
  status: JobStatus;
  phase: Phase;
  chars: number;
  startedAt: number;
  /** ms elapsed since startedAt; updated by global ticker. */
  elapsedMs: number;
  etaMs: number;
  error: string | null;
  title: string | null;
  text: string;
  source?: GenerationSource;
  provider?: string | null;
}

interface JobPhasePayload {
  job_id: string;
  phase: Exclude<Phase, "idle">;
  elapsed_ms: number;
  chars: number;
}

interface JobUpdatePayload {
  job_id: string;
  status: JobStatus;
  error: string | null;
}

interface JobsContextValue {
  jobs: Record<string, TrackedJob>;
  /** queued+running, oldest-first. */
  activeJobs: TrackedJob[];
  /** id of the most recently submitted job (for the main progress bar). */
  latestId: string | null;
  /** Add a Generation row returned from enqueue. */
  trackEnqueued: (gen: Generation) => void;
  /** Remove a job from the in-memory tracker (e.g. after user dismisses). */
  dropJob: (id: string) => void;
  /** Subscribe to terminal events; the callback receives the finalized Generation
   *  for `done` (other terminal statuses pass null and rely on the listener to
   *  refetch from list_jobs). */
  onDone: (cb: (gen: Generation) => void) => () => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Record<string, TrackedJob>>({});
  const [latestId, setLatestId] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const doneListenersRef = useRef<Set<(g: Generation) => void>>(new Set());

  const ensureTicker = useCallback(() => {
    if (tickRef.current !== null) return;
    tickRef.current = window.setInterval(() => {
      setJobs((prev) => {
        let changed = false;
        const next: Record<string, TrackedJob> = {};
        for (const [id, job] of Object.entries(prev)) {
          if (job.status === "queued" || job.status === "running") {
            const elapsed = performance.now() - job.startedAt;
            if (Math.abs(elapsed - job.elapsedMs) > 50) {
              next[id] = { ...job, elapsedMs: elapsed };
              changed = true;
              continue;
            }
          }
          next[id] = job;
        }
        return changed ? next : prev;
      });
    }, 200);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const trackEnqueued = useCallback((gen: Generation) => {
    const samples = loadSamples();
    const chars = (gen.text ?? "").length;
    const now = performance.now();
    setJobs((prev) => ({
      ...prev,
      [gen.id]: {
        id: gen.id,
        status: gen.status ?? "queued",
        phase: "preparing",
        chars,
        startedAt: now,
        elapsedMs: 0,
        etaMs: estimateEta(samples, chars),
        error: gen.error ?? null,
        title: gen.title,
        text: gen.text,
        source: gen.source,
        provider: gen.provider ?? null,
      },
    }));
    setLatestId(gen.id);
    ensureTicker();
  }, [ensureTicker]);

  const dropJob = useCallback((id: string) => {
    setJobs((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setLatestId((cur) => (cur === id ? null : cur));
  }, []);

  const onDone = useCallback((cb: (gen: Generation) => void) => {
    doneListenersRef.current.add(cb);
    return () => {
      doneListenersRef.current.delete(cb);
    };
  }, []);

  // Wire Tauri events.
  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    const unlistens: UnlistenFn[] = [];

    const attach = async () => {
      try {
        const u1 = await listen<JobPhasePayload>("job:phase", (e) => {
          if (cancelled) return;
          const p = e.payload;
          setJobs((prev) => {
            const cur = prev[p.job_id];
            if (!cur) return prev;
            return {
              ...prev,
              [p.job_id]: {
                ...cur,
                phase: p.phase,
                status: p.phase === "done" ? cur.status : "running",
              },
            };
          });
        });
        unlistens.push(u1);

        const u2 = await listen<JobUpdatePayload>("job:running", (e) => {
          if (cancelled) return;
          setJobs((prev) => {
            const cur = prev[e.payload.job_id];
            if (!cur) return prev;
            return { ...prev, [e.payload.job_id]: { ...cur, status: "running" } };
          });
        });
        unlistens.push(u2);

        const u3 = await listen<Generation>("job:done", (e) => {
          if (cancelled) return;
          const g = e.payload;
          // Persist latency sample.
          setJobs((prev) => {
            const cur = prev[g.id];
            if (cur && cur.chars > 0) {
              const latency = performance.now() - cur.startedAt;
              if (latency > 0) {
                const samples = loadSamples();
                samples.push({ chars: cur.chars, latency });
                saveSamples(samples);
              }
              return {
                ...prev,
                [g.id]: { ...cur, status: "done", phase: "done", elapsedMs: latency },
              };
            }
            return prev;
          });
          doneListenersRef.current.forEach((cb) => {
            try {
              cb(g);
            } catch {
              // ignore listener errors
            }
          });
          // Auto-clear shortly after done so the queue list shrinks.
          window.setTimeout(() => {
            setJobs((prev) => {
              if (!(g.id in prev)) return prev;
              const next = { ...prev };
              delete next[g.id];
              return next;
            });
          }, 1500);
        });
        unlistens.push(u3);

        const u4 = await listen<JobUpdatePayload>("job:error", (e) => {
          if (cancelled) return;
          const p = e.payload;
          setJobs((prev) => {
            const cur = prev[p.job_id];
            if (!cur) return prev;
            return { ...prev, [p.job_id]: { ...cur, status: "failed", error: p.error } };
          });
        });
        unlistens.push(u4);

        const u5 = await listen<JobUpdatePayload>("job:cancelled", (e) => {
          if (cancelled) return;
          setJobs((prev) => {
            const cur = prev[e.payload.job_id];
            if (!cur) return prev;
            return { ...prev, [e.payload.job_id]: { ...cur, status: "cancelled" } };
          });
        });
        unlistens.push(u5);
      } catch {
        // listen may fail outside Tauri; ignore.
      }
    };
    void attach();
    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
    };
  }, []);

  useEffect(() => () => stopTicker(), [stopTicker]);

  const activeJobs = useMemo(
    () =>
      Object.values(jobs)
        .filter((j) => j.status === "queued" || j.status === "running")
        .sort((a, b) => a.startedAt - b.startedAt),
    [jobs],
  );

  const value: JobsContextValue = {
    jobs,
    activeJobs,
    latestId,
    trackEnqueued,
    dropJob,
    onDone,
  };

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error("useJobs must be used inside <JobsProvider>");
  }
  return ctx;
}

/** Derived progress shape used by the main progress bar (single-job view). */
export interface JobProgressView {
  active: boolean;
  phase: Phase;
  elapsedMs: number;
  etaMs: number;
  progress: number;
  provider?: string | null;
  error?: string | null;
  failed: boolean;
}

export function useLatestJobProgress(): JobProgressView {
  const { jobs, latestId } = useJobs();
  const job = latestId ? jobs[latestId] : null;
  if (!job) {
    return {
      active: false,
      phase: "idle",
      elapsedMs: 0,
      etaMs: 0,
      progress: 0,
      failed: false,
    };
  }
  const active = job.status === "queued" || job.status === "running";
  const progress =
    active && job.etaMs > 0
      ? Math.min(0.99, job.elapsedMs / job.etaMs)
      : job.phase === "done"
        ? 1
        : 0;
  return {
    active,
    phase: job.phase,
    elapsedMs: job.elapsedMs,
    etaMs: job.etaMs,
    progress,
    provider: job.provider,
    error: job.error,
    failed: job.status === "failed",
  };
}
