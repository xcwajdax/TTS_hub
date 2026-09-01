import { useEffect, useRef, useState } from "react";

interface Options {
  text: string;
  currentTime: number;
  duration: number;
  scroll: boolean;
}

/** Sync vertical text scroll to playback position (popup-safe — no audioRef). */
export function useSyncedTextScroll({ text, currentTime, duration, scroll }: Options) {
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

    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const maxScroll = inner.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) {
      setOffsetY(0);
      return;
    }

    const ratio =
      Number.isFinite(duration) && duration > 0
        ? Math.min(1, Math.max(0, currentTime / duration))
        : 0;
    setOffsetY(-ratio * maxScroll);
  }, [scroll, overflows, currentTime, duration, text]);

  return { containerRef, innerRef, offsetY, overflows };
}
