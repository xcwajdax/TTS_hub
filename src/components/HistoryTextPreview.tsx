import { useEffect, useRef, useState } from "react";
import { usePlayback } from "../context/PlaybackContext";

interface Props {
  text: string;
  scroll: boolean;
}

/** Podgląd 3 linii; przy scroll=true przewija się wraz z postępem audio. */
export default function HistoryTextPreview({ text, scroll }: Props) {
  const { audioRef } = usePlayback();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const measure = () => {
      setOverflows(inner.scrollHeight > container.clientHeight + 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [text]);

  useEffect(() => {
    if (!scroll || !overflows) {
      setOffsetY(0);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const sync = () => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;

      const maxScroll = inner.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) {
        setOffsetY(0);
        return;
      }

      const duration = audio.duration;
      const ratio =
        Number.isFinite(duration) && duration > 0
          ? Math.min(1, Math.max(0, audio.currentTime / duration))
          : 0;
      setOffsetY(-ratio * maxScroll);
    };

    sync();
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("loadedmetadata", sync);

    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("loadedmetadata", sync);
    };
  }, [scroll, overflows, audioRef, text]);

  return (
    <div
      ref={containerRef}
      className={`history-text-preview${scroll && overflows ? " history-text-preview--scrolling" : ""}`}
    >
      <div
        ref={innerRef}
        className="history-text-preview__inner text-[12px] leading-snug text-muted whitespace-pre-wrap break-words"
        style={{ transform: scroll && overflows ? `translateY(${offsetY}px)` : undefined }}
      >
        {text}
      </div>
    </div>
  );
}
