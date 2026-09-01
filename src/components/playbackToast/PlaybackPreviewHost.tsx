import type { PlaybackPreviewMode } from "../../lib/textFiltersTypes";
import type { PlaybackVizFramePayload } from "../../lib/playbackToastContract";
import type { PlaybackStepView } from "../../lib/stepPlayback/types";
import KaraokeScrollPreview from "./previews/KaraokeScrollPreview";
import StepGuidePreview from "./previews/StepGuidePreview";

interface Props {
  mode: PlaybackPreviewMode;
  text: string;
  steps?: PlaybackStepView[];
  intro?: string;
  frame: PlaybackVizFramePayload | null;
  playing: boolean;
}

export default function PlaybackPreviewHost({
  mode,
  text,
  steps,
  intro,
  frame,
  playing,
}: Props) {
  const currentTime = frame?.currentTime ?? 0;
  const duration = frame?.duration ?? 0;

  if (mode === "compact-title") {
    return (
      <p className="text-[11px] text-muted leading-snug line-clamp-2 whitespace-pre-wrap">
        {text}
      </p>
    );
  }

  if (mode === "step-guide" && steps && steps.length > 0) {
    return (
      <StepGuidePreview
        steps={steps}
        intro={intro}
        currentTime={currentTime}
        duration={duration}
      />
    );
  }

  return (
    <KaraokeScrollPreview
      text={text}
      currentTime={currentTime}
      duration={duration}
      playing={playing}
    />
  );
}
