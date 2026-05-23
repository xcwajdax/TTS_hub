import { usePlayback } from "../context/PlaybackContext";
import { usePlaybackAnalyser } from "../hooks/usePlaybackAnalyser";
import PlaybackVizCanvas from "./PlaybackVizCanvas";

interface Props {
  active: boolean;
  volumeScale?: number;
  progress?: number;
  compact?: boolean;
  className?: string;
}

const COMPACT_BAR_COUNT = 24;
const DEFAULT_BAR_COUNT = 32;

export default function PlaybackVizEqualizer({
  active,
  volumeScale = 1,
  progress = 0,
  compact = false,
  className = "",
}: Props) {
  const { analyserRef } = usePlayback();
  const barCount = compact ? COMPACT_BAR_COUNT : DEFAULT_BAR_COUNT;
  const levels = usePlaybackAnalyser(analyserRef, active, volumeScale, barCount);

  return (
    <PlaybackVizCanvas
      active={active}
      levels={levels}
      progress={progress}
      compact={compact}
      className={className}
    />
  );
}
