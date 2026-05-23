import PlaybackVizEqualizer from "../PlaybackVizEqualizer";
import HistoryItemTimeline from "./HistoryItemTimeline";

interface Props {
  playing: boolean;
  className?: string;
}

export default function HistoryItemInlinePlayback({ playing, className = "" }: Props) {
  return (
    <div
      className={`history-item-playback grid grid-cols-4 gap-2 items-center ${className}`}
    >
      <PlaybackVizEqualizer active={playing} compact className="col-span-1 min-w-0" />
      <HistoryItemTimeline className="col-span-3 min-w-0" />
    </div>
  );
}
