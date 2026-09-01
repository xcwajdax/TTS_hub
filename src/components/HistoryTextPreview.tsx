import { useEffect, useState } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { useSyncedTextScroll } from "../hooks/useSyncedTextScroll";

interface Props {
  text: string;
  scroll: boolean;
}

/** Podgląd 3 linii; przy scroll=true przewija się wraz z postępem audio. */
export default function HistoryTextPreview({ text, scroll }: Props) {
  const { audioRef, playing } = usePlayback();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const sync = () => {
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
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
  }, [audioRef, scroll, text]);

  const { containerRef, innerRef, offsetY, overflows } = useSyncedTextScroll({
    text,
    currentTime,
    duration,
    scroll: scroll && (playing || currentTime > 0),
  });

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
