import type { TrackedJob } from "../context/JobsContext";
import { providerDisplayName } from "./jobProgressUi";
import type { GenerationToastViewModel } from "./playbackToastContract";

function jobSubtitle(job: TrackedJob): string {
  if (job.source === "quick_hotkey") {
    return `Skrót · ${providerDisplayName(job.provider)}`;
  }
  return providerDisplayName(job.provider);
}

function jobTitle(job: TrackedJob): string {
  return job.title?.trim() || job.text.split("\n")[0] || "(bez tytułu)";
}

/** Maps active generation jobs to a serializable popup view model. */
export function buildGenerationToastModel(activeJobs: TrackedJob[]): GenerationToastViewModel {
  const pending = activeJobs.filter((j) => j.status === "queued" || j.status === "running");
  const runningCount = pending.filter((j) => j.status === "running").length;
  const queuedCount = pending.filter((j) => j.status === "queued").length;

  return {
    runningCount,
    queuedCount,
    jobs: pending.map((job, index) => ({
      id: job.id,
      title: jobTitle(job),
      subtitle: jobSubtitle(job),
      status: job.status,
      phase: job.phase,
      provider: job.provider ?? null,
      elapsedMs: job.elapsedMs,
      etaMs: job.etaMs,
      error: job.error,
      voiceProfileId: job.voice_profile_id ?? null,
      source: job.source,
      originKind: job.origin_kind ?? null,
      originUserName: job.origin_user_name ?? null,
      queuePosition: index + 1,
      queueTotal: pending.length,
    })),
  };
}
