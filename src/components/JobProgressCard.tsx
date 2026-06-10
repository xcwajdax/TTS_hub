import type { TtsVoiceProfile } from "../appSettings";
import { PHASE_LABEL, type TrackedJob } from "../context/JobsContext";
import { fmtJobTime, jobProgressPercent, phaseLabelForProvider } from "../lib/jobProgressUi";
import { getSourceUi } from "../lib/historySourceUi";
import { resolveVoiceProfile } from "../lib/voiceProfiles";
import type { Phase } from "../context/JobsContext";
import VoiceProfileBadge from "./VoiceProfileBadge";

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
  voiceProfileId?: string | null;
  voiceProfiles?: TtsVoiceProfile[];
  source?: TrackedJob["source"];
  originKind?: string | null;
  originUserName?: string | null;
  queuePosition?: number | null;
  queueTotal?: number;
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
  voiceProfileId,
  voiceProfiles = [],
  source,
  originKind,
  originUserName,
  queuePosition,
  queueTotal,
}: JobProgressCardProps) {
  const active = status === "queued" || status === "running" || status === "capturing";
  const pct = jobProgressPercent(active, elapsedMs, etaMs, status);
  const resolvedProfile = resolveVoiceProfile(voiceProfiles, voiceProfileId);
  const sourceUi = source ? getSourceUi(source) : null;

  const label =
    status === "capturing"
      ? "Przechwytywanie zaznaczenia…"
      : status === "queued"
        ? queuePosition != null && queueTotal != null && queueTotal > 1
          ? `${queuePosition}. w kolejce (za ${queuePosition - 1})`
          : "W kolejce"
        : phaseLabelForProvider(phase, provider);

  const originBadge =
    originKind?.trim() &&
    (originUserName?.trim()
      ? `${originKind}: ${originUserName}`
      : originKind);

  return (
    <div
      className={`rounded-md border border-border bg-panel2/90 backdrop-blur-sm flex gap-2 ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2"
      }`}
    >
      <div className="shrink-0 pt-0.5">
        <VoiceProfileBadge
          profile={resolvedProfile}
          fallbackVoice={null}
          size="md"
          showName={false}
        />
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-heading" title={title}>
              {title}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {resolvedProfile && (
                <span className="text-[10px] text-accent truncate">{resolvedProfile.name}</span>
              )}
              {sourceUi && (
                <span
                  className="text-[9px] rounded px-1 py-0.5 shrink-0"
                  style={{ color: sourceUi.defaultColor }}
                >
                  {sourceUi.label}
                </span>
              )}
              {originBadge && (
                <span className="text-[9px] text-muted truncate" title={originBadge}>
                  {originBadge}
                </span>
              )}
              {subtitle && !resolvedProfile && (
                <span className="truncate text-[10px] text-muted" title={subtitle}>
                  {subtitle}
                </span>
              )}
            </div>
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
              {active && etaMs > 0 && status === "running" ? ` / ~${fmtJobTime(etaMs)}` : ""}
            </span>
          )}
        </div>
        <div className="h-1 w-full bg-panel rounded overflow-hidden">
          <div
            className={`h-full transition-[width] duration-200 ease-out ${
              status === "queued"
                ? "bg-muted/60 animate-pulse"
                : status === "capturing"
                  ? "bg-accent2/70 animate-pulse"
                  : "bg-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {status === "done" && !error && (
          <span className="text-[10px] text-emerald-400/90">{PHASE_LABEL.done}</span>
        )}
      </div>
    </div>
  );
}
