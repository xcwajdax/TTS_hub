import { useCallback, useEffect, useState } from "react";
import { usePlayback } from "../../context/PlaybackContext";
import { formatTime } from "../../lib/formatTime";

interface Props {
  className?: string;
}

/** Simple seekable timeline (3/4 width slot in history inline playback). */
export default function HistoryItemTimeline({ className = "" }: Props) {
  const { audioRef, seekTo } = usePlayback();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("durationchange", onDuration);
    onTime();
    onDuration();

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("durationchange", onDuration);
    };
  }, [audioRef]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const seekAtClientX = useCallback(
    (clientX: number, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const audio = audioRef.current;
      const total =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : duration > 0
            ? duration
            : 0;
      if (total <= 0) return;
      seekTo(ratio * total);
      setCurrentTime(audio?.currentTime ?? ratio * total);
    },
    [audioRef, duration, seekTo],
  );

  return (
    <div className={`history-item-timeline flex flex-col justify-center gap-1 min-w-0 ${className}`}>
      <div
        className="history-item-timeline__track relative h-2 rounded-full bg-panel border border-border/80 overflow-hidden cursor-pointer"
        role="progressbar"
        aria-label="Pozycja odtwarzania"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          seekAtClientX(e.clientX, e.currentTarget);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent2/70 transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex h-3 items-center justify-between text-[9px] leading-none tabular-nums text-muted">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
