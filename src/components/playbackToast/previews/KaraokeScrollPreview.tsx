import { useSyncedTextScroll } from "../../../hooks/useSyncedTextScroll";

interface Props {
  text: string;
  currentTime: number;
  duration: number;
  playing: boolean;
}

export default function KaraokeScrollPreview({ text, currentTime, duration, playing }: Props) {
  const { containerRef, innerRef, offsetY, overflows } = useSyncedTextScroll({
    text,
    currentTime,
    duration,
    scroll: playing || currentTime > 0,
  });

  return (
    <div
      ref={containerRef}
      className={`history-text-preview playback-toast-preview${
        overflows ? " history-text-preview--scrolling" : ""
      }`}
    >
      <div
        ref={innerRef}
        className="history-text-preview__inner text-[11px] leading-snug text-muted whitespace-pre-wrap break-words"
        style={{ transform: overflows ? `translateY(${offsetY}px)` : undefined }}
      >
        {text}
      </div>
    </div>
  );
}
