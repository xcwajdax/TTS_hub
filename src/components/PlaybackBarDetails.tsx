import { useRelativeTime } from "../hooks/useRelativeTime";
import {
  countWords,
  formatDurationMs,
  speechRateCharsPerSec,
} from "../lib/formatTime";
import type { Generation } from "../types";

interface Props {
  gen: Generation;
  sessionIndex?: number;
  sessionTotal?: number;
}

export default function PlaybackBarDetails({ gen, sessionIndex, sessionTotal }: Props) {
  const relative = useRelativeTime(gen.created_at);
  const date = new Date(gen.created_at);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const charCount = gen.text.length;
  const wordCount = countWords(gen.text);
  const rate = speechRateCharsPerSec(charCount, gen.duration_ms);
  const styleLabel = gen.style?.trim();

  const showSession =
    sessionIndex != null &&
    sessionIndex >= 0 &&
    sessionTotal != null &&
    sessionTotal > 0;

  return (
    <div className="flex flex-col items-end min-w-0 text-right gap-0.5">
      <div className="text-xs font-medium tabular-nums text-foreground">
        {formatDurationMs(gen.duration_ms)}
      </div>
      <div className="text-[10px] text-muted tabular-nums">
        {timeStr}
        <span className="text-muted/60"> · </span>
        {relative}
      </div>
      <div className="text-[10px] text-muted tabular-nums">
        {charCount} znaków · {wordCount}{" "}
        {wordCount === 1 ? "słowo" : wordCount < 5 ? "słowa" : "słów"}
        {rate && (
          <>
            <span className="text-muted/60"> · </span>
            {rate}
          </>
        )}
        {showSession && (
          <>
            <span className="text-muted/60"> · </span>
            {sessionIndex + 1} / {sessionTotal}
          </>
        )}
      </div>
      {styleLabel && (
        <span className="tag max-w-full truncate mt-0.5" title={styleLabel}>
          {styleLabel}
        </span>
      )}
    </div>
  );
}
