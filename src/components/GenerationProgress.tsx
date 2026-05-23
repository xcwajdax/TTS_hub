import {
  PHASE_LABEL,
  type GenerationProgress,
} from "../hooks/useGenerationProgress";
import {
  phaseLabelForProvider,
  providerDisplayName,
} from "../lib/jobProgressUi";

interface Props {
  progress: GenerationProgress;
}

function fmt(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.round(ms / 100) / 10;
  return `${total.toFixed(1)}s`;
}

export default function GenerationProgressBar({ progress }: Props) {
  const { active, phase, elapsedMs, etaMs, provider, error, failed } = progress;
  if (!active && phase !== "done" && !failed) return null;

  const pct = Math.round(progress.progress * 100);
  const remaining = Math.max(0, etaMs - elapsedMs);
  const overrun = active && elapsedMs > etaMs && etaMs > 0;
  const phaseLabel = phaseLabelForProvider(phase, provider);
  const providerName = providerDisplayName(provider);

  return (
    <div className="flex flex-col gap-2 w-full rounded-lg border border-border bg-panel2/80 px-3 py-2.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="truncate" title={phaseLabel}>
          {failed ? "Błąd generacji" : phaseLabel}
        </span>
        <span className="tabular-nums">
          {fmt(elapsedMs)}
          {active && etaMs > 0 && (
            <>
              {" / "}
              <span className={overrun ? "text-amber-400" : ""}>~{fmt(etaMs)}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-2 w-full bg-panel rounded overflow-hidden">
        <div
          className={`h-full transition-[width] duration-200 ease-out ${
            failed
              ? "bg-red-500"
              : overrun
                ? "bg-amber-500"
                : phase === "done"
                  ? "bg-emerald-500"
                  : "bg-accent"
          }`}
          style={{ width: `${failed ? 100 : pct}%` }}
        />
      </div>
      {failed && error?.trim() && (
        <div className="text-[10px] text-red-300" title={error}>
          {error}
        </div>
      )}
      {active && etaMs > 0 && !overrun && (
        <div className="text-[10px] text-muted tabular-nums">
          pozostalo ~{fmt(remaining)}
        </div>
      )}
      {overrun && !failed && (
        <div className="text-[10px] text-amber-400">
          {providerName} odpowiada wolniej niz zwykle...
        </div>
      )}
      {phase === "done" && !failed && (
        <div className="text-[10px] text-emerald-400">{PHASE_LABEL.done}</div>
      )}
    </div>
  );
}
