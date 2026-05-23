import { PHASE_LABEL, type TrackedJob } from "../context/JobsContext";
import { fmtJobTime, jobProgressPercent, phaseLabelForProvider } from "../lib/jobProgressUi";
import type { Phase } from "../context/JobsContext";

export interface JobProgressCardProps {
  title: string;
  subtitle?: string;
  status: TrackedJob["status"] | "capturing";
  phase?: Phase;
  provider?: string | null;
  elapsedMs?: number;
  etaMs?: number;
  error?: string | null;
  onCancel?: () => void;
  compact?: boolean;
}

export default function JobProgressCard({
  title,
  subtitle,
  status,
  phase = "preparing",
  provider,
  elapsedMs = 0,
  etaMs = 0,
  error,
  onCancel,
  compact = false,
}: JobProgressCardProps) {
  const active = status === "queued" || status === "running" || status === "capturing";
  const pct = jobProgressPercent(active, elapsedMs, etaMs, status);
  const label =
    status === "capturing"
      ? "Przechwytywanie zaznaczenia…"
      : status === "queued"
        ? "W kolejce"
        : phaseLabelForProvider(phase, provider);

  return (
    <div
      className={`rounded-md border border-border bg-panel2/90 backdrop-blur-sm flex flex-col gap-1 ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-heading" title={title}>
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[10px] text-muted" title={subtitle}>
              {subtitle}
            </div>
          )}
        </div>
        {onCancel && active && (
          <button
            type="button"
            className="text-[11px] text-muted hover:text-red-300 shrink-0"
            onClick={onCancel}
          >
            Anuluj
          </button>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span className={status === "failed" ? "text-red-300" : ""}>{error?.trim() || label}</span>
        {status !== "capturing" && (
          <span className="tabular-nums shrink-0">
            {fmtJobTime(elapsedMs)}
            {active && etaMs > 0 ? ` / ~${fmtJobTime(etaMs)}` : ""}
          </span>
        )}
      </div>
      <div className="h-1 w-full bg-panel rounded overflow-hidden">
        <div
          className={`h-full transition-[width] duration-200 ease-out ${
            status === "queued" ? "bg-muted/60 animate-pulse" : status === "capturing" ? "bg-accent2/70 animate-pulse" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {status === "done" && !error && (
        <span className="text-[10px] text-emerald-400/90">{PHASE_LABEL.done}</span>
      )}
    </div>
  );
}
