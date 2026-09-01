import { useEffect, useRef } from "react";
import type { Mp4ExportState, Mp4LogEntry } from "./useMp4Export";
import { formatTime } from "../lib/formatTime";

interface Props {
  state: Mp4ExportState;
  liveEtaMs: number | null;
  /** When true, show ETA even if backend hasn't started streaming yet. */
  showEtaWhenIdle?: boolean;
  /** Total estimated time the user might wait (for the ETA → progress fraction). */
  totalEstimatedMs?: number | null;
  className?: string;
}

const PHASE_LABEL: Record<Mp4ExportState["phase"], string> = {
  idle: "Bezczynny",
  starting: "Startuję…",
  render: "Renderuję…",
  done: "Gotowe",
  error: "Błąd",
};

const PHASE_TONE: Record<Mp4ExportState["phase"], string> = {
  idle: "bg-panel2 text-muted",
  starting: "bg-blue-900/40 text-blue-200",
  render: "bg-amber-900/40 text-amber-200",
  done: "bg-emerald-900/50 text-emerald-100",
  error: "bg-red-900/50 text-red-100",
};

function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatLogTime(at: number): string {
  const d = new Date(at);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const KIND_COLOR: Record<Mp4LogEntry["kind"], string> = {
  info: "text-heading",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-red-300",
};

export default function Mp4LogPanel({
  state,
  liveEtaMs,
  showEtaWhenIdle = false,
  className = "",
}: Props) {
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  const showBar = state.phase !== "idle";
  const pct = Math.round(Math.max(0, Math.min(1, state.percent || 0)) * 100);
  const etaLabel =
    state.phase === "done"
      ? "Zakończono"
      : state.phase === "error"
        ? "Przerwano"
        : liveEtaMs == null
          ? "—"
          : formatClock(liveEtaMs);

  const elapsedMs =
    state.startedAtMs != null
      ? Math.max(0, (state.finishedAtMs ?? Date.now()) - state.startedAtMs)
      : null;

  return (
    <div
      className={`mp4-log-panel flex flex-col gap-3 rounded-lg border border-border bg-panel2/40 p-3 ${className}`}
    >
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${PHASE_TONE[state.phase]}`}
          data-phase={state.phase}
        >
          {PHASE_LABEL[state.phase]}
        </span>
        <span className="text-muted truncate min-w-0" title={state.message}>
          {state.message || (state.phase === "idle" ? "Kliknij „Generuj MP4”, aby rozpocząć" : "")}
        </span>
        <span className="ml-auto text-muted whitespace-nowrap">
          <span className="mr-3" data-testid="mp4-elapsed">
            czas: {elapsedMs != null ? formatClock(elapsedMs) : "—"}
          </span>
          <span data-testid="mp4-eta">
            pozostało: {showEtaWhenIdle || state.phase !== "idle" ? etaLabel : "—"}
          </span>
        </span>
      </div>

      {showBar && (
        <div
          className="h-2 w-full bg-panel2/80 rounded overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Postęp eksportu MP4"
        >
          <div
            className={`h-full transition-[width] duration-200 ease-out ${
              state.phase === "error" ? "bg-red-400" : state.phase === "done" ? "bg-emerald-400" : "bg-accent"
            }`}
            style={{ width: `${Math.max(pct, state.phase === "starting" ? 4 : 0)}%` }}
          />
        </div>
      )}

      <div
        ref={logRef}
        className="mp4-log-panel__log flex flex-col gap-0.5 max-h-44 overflow-y-auto rounded border border-border/60 bg-black/40 p-2 text-[11px] font-mono leading-relaxed"
        aria-live="polite"
      >
        {state.log.length === 0 ? (
          <p className="text-muted">Log pojawi się po uruchomieniu eksportu…</p>
        ) : (
          state.log.map((entry, idx) => (
            <div key={`${entry.at}-${idx}`} className="flex gap-2">
              <span className="text-muted shrink-0">{formatLogTime(entry.at)}</span>
              <span className={`whitespace-pre-wrap break-words min-w-0 ${KIND_COLOR[entry.kind]}`}>
                {entry.text}
              </span>
            </div>
          ))
        )}
      </div>

      {state.phase === "error" && state.error && (
        <div className="text-[11px] text-red-300">
          {state.error}
        </div>
      )}
      {state.phase === "done" && state.startedAtMs && state.finishedAtMs && (
        <div className="text-[11px] text-emerald-300">
          Zakończono w {formatTime((state.finishedAtMs - state.startedAtMs) / 1000)}
        </div>
      )}
    </div>
  );
}
