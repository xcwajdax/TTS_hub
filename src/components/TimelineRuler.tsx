import { useEffect, useRef, useState } from "react";
import { buildTimelineTicks } from "../lib/timelineRuler";

interface Props {
  duration: number;
  className?: string;
}

export default function TimelineRuler({ duration, className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth));
    ro.observe(el);
    setWidthPx(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const ticks = buildTimelineTicks(duration, widthPx);
  const lastIndex = ticks.length - 1;

  return (
    <div
      ref={wrapRef}
      className={`playback-timeline__ruler absolute inset-x-0 top-0 z-10 pointer-events-none select-none ${className}`.trim()}
      aria-hidden
    >
      {ticks.map((tick, index) => {
        const isFirst = index === 0;
        const isLast = index === lastIndex;

        if (isFirst) {
          return (
            <div key={`${tick.sec}-start`} className="absolute top-0 left-0 flex flex-col items-start">
              <span className="text-[9px] tabular-nums text-muted/90 leading-none whitespace-nowrap drop-shadow-sm">
                {tick.label}
              </span>
            </div>
          );
        }

        if (isLast) {
          return (
            <div key={`${tick.sec}-end`} className="absolute top-0 right-0 flex flex-col items-end">
              <span className="text-[9px] tabular-nums text-muted/90 leading-none whitespace-nowrap drop-shadow-sm">
                {tick.label}
              </span>
            </div>
          );
        }

        return (
          <div
            key={`${tick.sec}-${tick.xRatio}`}
            className="absolute top-0 flex flex-col items-center -translate-x-1/2"
            style={{ left: `${tick.xRatio * 100}%` }}
          >
            <span className="text-[9px] tabular-nums text-muted/80 leading-none whitespace-nowrap drop-shadow-sm">
              {tick.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
