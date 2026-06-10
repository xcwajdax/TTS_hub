import { confirm } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import {
  approveGenerations,
  cancelJob,
  discardJob,
  getAppSettings,
  listJobs,
  rejectGenerations,
  resumeJob,
} from "../api/tauri";
import { useJobs, type TrackedJob } from "../context/JobsContext";
import { useRelativeTime } from "../hooks/useRelativeTime";
import { providerDisplayName } from "../lib/jobProgressUi";
import { getSourceUi } from "../lib/historySourceUi";
import {
  HISTORY_PREFS_CHANGED,
  loadJobsPanelCollapsed,
  saveJobsPanelCollapsed,
} from "../lib/historyPlaybackPrefs";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { Generation } from "../types";
import type { TtsVoiceProfile } from "../appSettings";
import JobProgressCard from "./JobProgressCard";
import Icon from "./Icon";
import { isTauriApp } from "../lib/tauriEnv";

interface Props {
  interrupted: Generation[];
  onChanged: () => void;
  onError: (e: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

function ActiveJobRow({
  job,
  queuePosition,
  queueTotal,
  voiceProfiles,
  onCancel,
}: {
  job: TrackedJob;
  queuePosition: number;
  queueTotal: number;
  voiceProfiles: TtsVoiceProfile[];
  onCancel: () => void;
}) {
  return (
    <JobProgressCard
      title={job.title?.trim() || job.text.split("\n")[0] || "(bez tytułu)"}
      subtitle={
        job.source === "quick_hotkey"
          ? `Skrót · ${providerDisplayName(job.provider)}`
          : providerDisplayName(job.provider)
      }
      status={job.status}
      phase={job.phase}
      provider={job.provider}
      elapsedMs={job.elapsedMs}
      etaMs={job.etaMs}
      error={job.error}
      onCancel={onCancel}
      compact
      voiceProfileId={job.voice_profile_id}
      voiceProfiles={voiceProfiles}
      source={job.source}
      originKind={job.origin_kind}
      originUserName={job.origin_user_name}
      queuePosition={queuePosition}
      queueTotal={queueTotal}
    />
  );
}

function InterruptedRow({
  gen,
  onResume,
  onDiscard,
}: {
  gen: Generation;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const labelMap: Record<string, string> = {
    interrupted: "Niedokończone",
    failed: "Błąd",
    cancelled: "Anulowane",
  };
  const label = labelMap[gen.status] ?? gen.status;
  return (
    <div className="rounded-md border border-amber-700/60 bg-amber-900/15 px-2 py-1.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 truncate text-xs" title={gen.text}>
          {gen.title?.trim() || gen.text.split("\n")[0] || "(bez tytułu)"}
        </div>
        <span className="text-[10px] text-amber-300 shrink-0">{label}</span>
      </div>
      {gen.error && (
        <div className="text-[10px] text-amber-300/80 truncate" title={gen.error}>
          {gen.error}
        </div>
      )}
      <div className="flex gap-1">
        <button type="button" className="btn text-[11px] flex-1" onClick={onResume}>
          Wznów
        </button>
        <button
          type="button"
          className="btn text-[11px] flex-1 hover:!bg-red-900/40"
          onClick={onDiscard}
        >
          Odrzuć
        </button>
      </div>
    </div>
  );
}

function ApprovalRow({
  gen,
  selected,
  onToggle,
}: {
  gen: Generation;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rel = useRelativeTime(gen.created_at);
  const sourceUi = getSourceUi(gen.source);
  const title = gen.title?.trim() || gen.text.split("\n")[0] || "(bez tytułu)";
  const chars = gen.text.length;

  return (
    <div className="rounded-md border border-amber-600/50 bg-amber-950/20 px-2 py-1.5 flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={selected}
          onChange={onToggle}
          aria-label={`Zaznacz: ${title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs truncate" title={gen.text}>
            {title}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted mt-0.5">
            <span className="inline-flex items-center gap-0.5" style={{ color: sourceUi.defaultColor }}>
              <Icon name={sourceUi.icon} size={10} />
              {sourceUi.label}
            </span>
            <span>·</span>
            <span>{providerDisplayName(gen.provider)}</span>
            <span>·</span>
            <span>{chars} zn.</span>
            <span>·</span>
            <span>{rel}</span>
          </div>
        </div>
        <button
          type="button"
          className="text-[10px] text-muted hover:text-heading shrink-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Zwiń" : "Tekst"}
        </button>
      </div>
      {expanded && (
        <pre className="text-[10px] text-muted/90 whitespace-pre-wrap break-words m-0 max-h-28 overflow-y-auto rounded bg-panel/60 p-1.5 border border-border/50">
          {gen.text}
        </pre>
      )}
    </div>
  );
}

export default function GenerationQueuePanel({
  interrupted,
  onChanged,
  onError,
  voiceProfiles: voiceProfilesProp = [],
}: Props) {
  const { activeJobs, trackEnqueued } = useJobs();
  const [pending, setPending] = useState<Generation[]>([]);
  const [safeMode, setSafeMode] = useState(false);
  const [collapsed, setCollapsed] = useState(loadJobsPanelCollapsed);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [voiceProfiles, setVoiceProfiles] = useState(voiceProfilesProp);

  useEffect(() => {
    setVoiceProfiles(voiceProfilesProp);
  }, [voiceProfilesProp]);

  useEffect(() => {
    if (voiceProfilesProp.length > 0) return;
    let cancelled = false;
    void getAppSettings()
      .then((view) => {
        if (!cancelled) setVoiceProfiles(view.voice_profiles ?? []);
      })
      .catch(() => {});
    const onChange = () => {
      void getAppSettings()
        .then((view) => setVoiceProfiles(view.voice_profiles ?? []))
        .catch(() => {});
    };
    window.addEventListener(VOICE_PROFILES_CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_PROFILES_CHANGED, onChange);
    };
  }, [voiceProfilesProp.length]);

  const refreshPending = useCallback(async () => {
    if (!isTauriApp()) return;
    try {
      const [list, settings] = await Promise.all([
        listJobs("pending_approval"),
        getAppSettings(),
      ]);
      setPending(list);
      setSafeMode(!!settings.safe_mode);
      window.dispatchEvent(new Event("tts-hub.approval-queue.changed"));
      setSelectedIds((prev) => {
        const ids = new Set(list.map((g) => g.id));
        const next = new Set<string>();
        for (const id of prev) {
          if (ids.has(id)) next.add(id);
        }
        return next;
      });
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const sync = () => setCollapsed(loadJobsPanelCollapsed());
    window.addEventListener(HISTORY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(HISTORY_PREFS_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;
    let unlistenPending: (() => void) | undefined;
    let unlistenSafe: (() => void) | undefined;
    void listen<Generation>("job:pending_approval", (e) => {
      const gen = e.payload;
      setPending((prev) => (prev.some((g) => g.id === gen.id) ? prev : [...prev, gen]));
      void getAppSettings()
        .then((settings) => {
          if (settings.safe_mode_auto_open_queue ?? true) {
            setCollapsed(false);
            saveJobsPanelCollapsed(false);
          }
        })
        .catch(() => {});
      window.dispatchEvent(new Event("tts-hub.approval-queue.changed"));
    }).then((fn) => {
      unlistenPending = fn;
    });
    void listen<boolean>("safe_mode:changed", (e) => {
      setSafeMode(!!e.payload);
    }).then((fn) => {
      unlistenSafe = fn;
    });
    return () => {
      unlistenPending?.();
      unlistenSafe?.();
    };
  }, []);

  const runningCount = activeJobs.filter((j) => j.status === "running").length;
  const queuedCount = activeJobs.filter((j) => j.status === "queued").length;
  const totalActive = activeJobs.length;
  const pendingCount = pending.length;
  const showApprovalSection = safeMode || pendingCount > 0;

  const visible =
    safeMode || pendingCount > 0 || totalActive > 0 || interrupted.length > 0;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveJobsPanelCollapsed(next);
  };

  const allSelected = pendingCount > 0 && selectedIds.size === pendingCount;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pending.map((g) => g.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runApprove = async (ids: string[]) => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      const toTrack = pending.filter((g) => ids.includes(g.id));
      await approveGenerations(ids);
      for (const gen of toTrack) {
        trackEnqueued({ ...gen, status: "queued" });
      }
      setSelectedIds(new Set());
      await refreshPending();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runReject = async (ids: string[]) => {
    if (ids.length === 0 || busy) return;
    if (ids.length > 1) {
      const ok = await confirm(`Odrzucić ${ids.length} generacji z kolejki zatwierdzeń?`, {
        title: "Odrzuć zaznaczone",
        kind: "warning",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await rejectGenerations(ids);
      setSelectedIds(new Set());
      await refreshPending();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelJob(id);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleResume = async (gen: Generation) => {
    try {
      const queued = await resumeJob(gen.id);
      trackEnqueued(queued);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await discardJob(id);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  if (!visible) return null;

  if (collapsed) {
    return (
      <div className="border-b border-border shrink-0">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] bg-panel/50 hover:bg-panel2/60"
          onClick={toggleCollapsed}
          aria-expanded={false}
        >
          <span className="flex items-center gap-1.5 text-muted flex-wrap">
            {safeMode && <span className="text-amber-300/90" aria-hidden>🔒</span>}
            <span>Kolejka</span>
            {runningCount > 0 && (
              <span className="text-accent tabular-nums">{runningCount} w toku</span>
            )}
            {queuedCount > 0 && (
              <span className="tabular-nums">
                {runningCount > 0 ? " · " : ""}
                {queuedCount} w kolejce
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-amber-300 tabular-nums">
                {(runningCount > 0 || queuedCount > 0) ? " · " : ""}
                {pendingCount} do zatw.
              </span>
            )}
            {totalActive === 0 && interrupted.length > 0 && (
              <span className="text-amber-300">{interrupted.length} do odzyskania</span>
            )}
          </span>
          <Icon name="chevron-down" size={12} className="shrink-0 text-muted" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-2 py-2 flex flex-col gap-2 bg-panel/50 shrink-0">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-[10px] uppercase tracking-wide text-muted m-0 flex items-center gap-1.5 flex-wrap">
          {safeMode && <span className="text-amber-300/90 normal-case" aria-hidden>🔒</span>}
          Kolejka generacji
          {totalActive > 0 && (
            <span className="normal-case text-accent/90 tabular-nums">
              · {runningCount} w toku · {queuedCount} w kolejce
            </span>
          )}
        </h3>
        <button
          type="button"
          className="text-[10px] text-muted hover:text-heading shrink-0"
          onClick={toggleCollapsed}
          title="Zwiń panel"
        >
          Zwiń
        </button>
      </div>

      {activeJobs.length > 0 && (
        <section className="flex flex-col gap-1.5">
          {activeJobs.map((j, index) => (
            <ActiveJobRow
              key={j.id}
              job={j}
              queuePosition={index + 1}
              queueTotal={activeJobs.length}
              voiceProfiles={voiceProfiles}
              onCancel={() => void handleCancel(j.id)}
            />
          ))}
        </section>
      )}

      {showApprovalSection && (
        <section
          className={`flex flex-col gap-1.5 ${
            activeJobs.length > 0 ? "pt-1 border-t border-amber-800/30" : ""
          }`}
        >
          <h4 className="text-[10px] uppercase tracking-wide text-amber-200/80 px-1 m-0">
            Do zatwierdzenia
            {pendingCount > 0 && (
              <span className="normal-case ml-1 text-amber-300/90 tabular-nums">
                · {pendingCount}
              </span>
            )}
          </h4>

          {pendingCount === 0 ? (
            <p className="text-[11px] text-muted m-0 px-1">
              Tryb bezpieczny włączony — nowe generacje pojawią się tutaj.
            </p>
          ) : (
            <>
              <label className="flex items-center gap-1.5 text-[10px] text-muted px-1 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                Zaznacz wszystkie
              </label>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {pending.map((gen) => (
                  <ApprovalRow
                    key={gen.id}
                    gen={gen}
                    selected={selectedIds.has(gen.id)}
                    onToggle={() => toggleOne(gen.id)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5 border-t border-amber-800/40">
                <span className="text-[10px] text-muted tabular-nums shrink-0">
                  Zaznaczono: {selectedIds.size}
                </span>
                <button
                  type="button"
                  className="btn text-[10px] !py-0.5 !px-2"
                  disabled={selectedIds.size === 0 || busy}
                  onClick={() => void runApprove([...selectedIds])}
                >
                  Zatwierdź
                </button>
                <button
                  type="button"
                  className="btn text-[10px] !py-0.5 !px-2 hover:!bg-red-900/40"
                  disabled={selectedIds.size === 0 || busy}
                  onClick={() => void runReject([...selectedIds])}
                >
                  Odrzuć
                </button>
                <button
                  type="button"
                  className="btn text-[10px] !py-0.5 !px-2 ml-auto"
                  disabled={busy}
                  onClick={() => void runApprove(pending.map((g) => g.id))}
                >
                  Zatwierdź wszystkie
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {interrupted.length > 0 && (
        <section className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
          <h4 className="text-[10px] uppercase tracking-wide text-amber-300/80 px-1 m-0">
            Do odzyskania ({interrupted.length})
          </h4>
          {interrupted.map((g) => (
            <InterruptedRow
              key={g.id}
              gen={g}
              onResume={() => void handleResume(g)}
              onDiscard={() => void handleDiscard(g.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
