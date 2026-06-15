import { useCallback } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { TtsVoiceProfile } from "../../appSettings";
import {
  MAIN_WINDOW_LABEL,
  PlaybackToastEvents,
  type GenerationToastViewModel,
} from "../../lib/playbackToastContract";
import JobProgressCard from "../JobProgressCard";
import Icon from "../Icon";
import ToastWindowPanel from "../toast/ToastWindowPanel";

const ICON = 14;

interface Props {
  model: GenerationToastViewModel;
  voiceProfiles: TtsVoiceProfile[];
  onHide: () => void;
}

function emitMain<T>(event: string, payload?: T): void {
  void emitTo(MAIN_WINDOW_LABEL, event, payload ?? {});
}

export default function GenerationToastPanel({ model, voiceProfiles, onHide }: Props) {
  const headerSuffix =
    model.jobs.length > 1
      ? ` · ${model.runningCount} w toku · ${model.queuedCount} w kolejce`
      : model.runningCount > 0
        ? " · w toku"
        : model.queuedCount > 0
          ? " · w kolejce"
          : "";

  const onCancel = useCallback((jobId: string) => {
    emitMain(PlaybackToastEvents.cancelJob, { jobId });
  }, []);

  return (
    <ToastWindowPanel compact title={`Generowanie${headerSuffix}`}>
      <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto -m-0.5 p-0.5">
        {model.jobs.map((job) => (
          <JobProgressCard
            key={job.id}
            title={job.title}
            subtitle={job.subtitle}
            status={job.status}
            phase={job.phase}
            provider={job.provider}
            elapsedMs={job.elapsedMs}
            etaMs={job.etaMs}
            error={job.error}
            onCancel={() => onCancel(job.id)}
            compact
            voiceProfileId={job.voiceProfileId}
            voiceProfiles={voiceProfiles}
            source={job.source}
            originKind={job.originKind}
            originUserName={job.originUserName}
            queuePosition={job.queuePosition}
            queueTotal={job.queueTotal}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm ml-auto"
          onClick={onHide}
          title="Schowaj"
          aria-label="Schowaj okno"
        >
          Schowaj
        </button>
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--icon toast-toolbar__btn--danger"
          onClick={onHide}
          title="Zamknij"
          aria-label="Zamknij"
        >
          <Icon name="x-circle" size={ICON} />
        </button>
      </div>
    </ToastWindowPanel>
  );
}

export async function emitGenerationUserHide(): Promise<void> {
  emitMain(PlaybackToastEvents.userHide);
  await invoke("hide_playback_toast");
}
