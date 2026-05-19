import { cancelJob, discardJob, resumeJob } from "../api/tauri";
import { PHASE_LABEL, useJobs, type TrackedJob } from "../context/JobsContext";
import type { Generation } from "../types";


interface Props {
  interrupted: Generation[];
  onChanged: () => void;
  onError: (e: string) => void;
}

function fmtTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
}

function ActiveJobRow({ job, onCancel }: { job: TrackedJob; onCancel: () => void }) {
  const active = job.status === "queued" || job.status === "running";
  const pct =
    active && job.etaMs > 0
      ? Math.min(99, Math.round((job.elapsedMs / job.etaMs) * 100))
      : 0;
  const label = job.status === "queued" ? "W kolejce" : PHASE_LABEL[job.phase];
  return (
    <div className="rounded-md border border-border bg-panel2/60 px-2 py-1.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 truncate text-xs" title={job.text}>
          {job.title?.trim() || job.text.split("\n")[0] || "(bez tytułu)"}
        </div>
        <button
          type="button"
          className="text-[11px] text-muted hover:text-red-300"
          onClick={onCancel}
          title="Anuluj"
        >
          Anuluj
        </button>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {fmtTime(job.elapsedMs)}
          {active && job.etaMs > 0 ? ` / ~${fmtTime(job.etaMs)}` : ""}
        </span>
      </div>
      <div className="h-1 w-full bg-panel rounded overflow-hidden">
        <div
          className={`h-full transition-[width] duration-200 ease-out ${
            job.status === "queued" ? "bg-muted/60" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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

export default function ActiveJobsPanel({ interrupted, onChanged, onError }: Props) {
  const { activeJobs, trackEnqueued } = useJobs();

  if (activeJobs.length === 0 && interrupted.length === 0) return null;

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

  return (
    <div className="border-b border-border px-2 py-2 flex flex-col gap-2 bg-panel/50">
      {activeJobs.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-wide text-muted px-1">
            Aktywne zadania ({activeJobs.length})
          </h3>
          {activeJobs.map((j) => (
            <ActiveJobRow key={j.id} job={j} onCancel={() => void handleCancel(j.id)} />
          ))}
        </section>
      )}
      {interrupted.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-wide text-amber-300/80 px-1">
            Do odzyskania ({interrupted.length})
          </h3>
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
