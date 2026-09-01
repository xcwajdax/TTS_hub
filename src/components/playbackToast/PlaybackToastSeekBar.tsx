import { useCallback } from "react";
import { formatTime } from "../../lib/formatTime";
import type { PlaybackVizFramePayload } from "../../lib/playbackToastContract";
import { playbackToastControl } from "../../lib/playbackToastControl";
import {
  isPlaybackPositionLockEnabled,
  setPlaybackPositionLockEnabled,
} from "../../lib/playbackPositionLock";

interface Props {
  frame: PlaybackVizFramePayload | null;
  onPositionLockChange?: (enabled: boolean) => void;
}

export default function PlaybackToastSeekBar({ frame, onPositionLockChange }: Props) {
  const duration = frame?.duration ?? 0;
  const currentTime = frame?.currentTime ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;
  const lockEnabled = frame?.positionLockEnabled ?? isPlaybackPositionLockEnabled();

  const seekAtRatio = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const seconds = Math.min(Math.max(0, ratio), 1) * duration;
      void playbackToastControl({ action: "seek", seconds });
    },
    [duration],
  );

  const onTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekAtRatio((e.clientX - rect.left) / rect.width);
    },
    [seekAtRatio],
  );

  const toggleLock = useCallback(() => {
    const next = !lockEnabled;
    setPlaybackPositionLockEnabled(next);
    onPositionLockChange?.(next);
    void playbackToastControl({ action: "setPositionLock", enabled: next });
  }, [lockEnabled, onPositionLockChange]);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`toast-toolbar__btn toast-toolbar__btn--icon shrink-0 ${lockEnabled ? "text-accent2" : "text-muted"}`}
          onClick={toggleLock}
          title={lockEnabled ? "Odblokuj zapisywanie pozycji" : "Zablokuj pozycję między sesjami"}
          aria-label={lockEnabled ? "Odblokuj pozycję" : "Zablokuj pozycję"}
          aria-pressed={lockEnabled}
        >
          <span className="text-[11px]" aria-hidden>
            {lockEnabled ? "🔒" : "🔓"}
          </span>
        </button>
        <div
          className="flex-1 h-4 flex items-center cursor-pointer group"
          onClick={onTrackClick}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-label="Pozycja odtwarzania"
        >
          <div className="w-full h-1 rounded-full bg-panel2 border border-border/40 overflow-hidden">
            <div
              className="h-full bg-accent2/80 transition-[width] duration-75"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <span className="text-[9px] tabular-nums text-muted shrink-0 min-w-[4.5rem] text-right">
          {duration > 0
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : "—"}
        </span>
      </div>
    </div>
  );
}
