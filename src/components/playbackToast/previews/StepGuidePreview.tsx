import { useMemo } from "react";
import type { PlaybackStepView } from "../../../lib/stepPlayback/types";
import { stepAtTime } from "../../../lib/stepPlayback/computeTimings";
import { playbackToastControl } from "../../../lib/playbackToastControl";

interface Props {
  steps: PlaybackStepView[];
  intro?: string;
  currentTime: number;
  duration: number;
}

export default function StepGuidePreview({ steps, intro, currentTime, duration }: Props) {
  const currentTimeMs = currentTime * 1000;
  const active = useMemo(
    () => stepAtTime({ steps, intro }, currentTimeMs),
    [steps, intro, currentTimeMs],
  );
  const activeIndex = active ? steps.findIndex((s) => s.index === active.index) : 0;

  const seekStep = (index: number) => {
    const step = steps[index];
    if (!step) return;
    void playbackToastControl({ action: "seek", seconds: step.startMs / 1000 });
  };

  if (steps.length === 0) {
    return <p className="text-[11px] text-muted">Brak wykrytych kroków.</p>;
  }

  return (
    <div className="playback-toast-step-guide flex flex-col gap-1 min-h-0">
      {intro && activeIndex === 0 && currentTimeMs < (steps[0]?.startMs ?? 0) && (
        <p className="text-[10px] text-muted/80 italic line-clamp-2">{intro}</p>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wide text-muted">
          Krok {activeIndex + 1}/{steps.length}
        </span>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm"
            disabled={activeIndex <= 0}
            onClick={() => seekStep(activeIndex - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm"
            disabled={activeIndex >= steps.length - 1}
            onClick={() => seekStep(activeIndex + 1)}
          >
            →
          </button>
        </div>
      </div>
      <p className="text-[11px] font-medium leading-snug line-clamp-2">
        {active?.label ?? steps[0]?.label}
      </p>
      <p className="text-[10px] text-muted leading-snug line-clamp-3 whitespace-pre-wrap">
        {active?.text}
      </p>
      {duration > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {steps.map((step, i) => (
            <button
              key={step.index}
              type="button"
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === activeIndex ? "bg-accent2" : i < activeIndex ? "bg-accent2/40" : "bg-panel2"
              }`}
              onClick={() => seekStep(i)}
              title={`Krok ${step.index}`}
              aria-label={`Krok ${step.index}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
