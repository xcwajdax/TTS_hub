function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function tickStep(pxPerSec: number): number {
  if (pxPerSec >= 120) return 1;
  if (pxPerSec >= 60) return 2;
  if (pxPerSec >= 30) return 5;
  if (pxPerSec >= 12) return 10;
  if (pxPerSec >= 6) return 30;
  if (pxPerSec >= 3) return 60;
  return 120;
}

interface Props {
  pxPerSec: number;
  durationSec: number;
  cursorSec: number;
  width: number;
}

export default function TimeRuler({ pxPerSec, durationSec, cursorSec, width }: Props) {
  const step = tickStep(pxPerSec);
  const ticks: number[] = [];
  for (let t = 0; t <= durationSec + step; t += step) {
    ticks.push(t);
  }

  return (
    <div className="relative h-6 border-b border-border bg-panel shrink-0 select-none" style={{ width }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 bottom-0 border-l border-border/60 pointer-events-none"
          style={{ left: t * pxPerSec }}
        >
          <span className="absolute top-0.5 left-1 text-[10px] text-muted font-mono whitespace-nowrap">
            {formatTime(t)}
          </span>
        </div>
      ))}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
        style={{ left: cursorSec * pxPerSec }}
      />
    </div>
  );
}

export function TimelineGridLines({
  pxPerSec,
  durationSec,
  width,
  height,
}: {
  pxPerSec: number;
  durationSec: number;
  width: number;
  height: number;
}) {
  const step = tickStep(pxPerSec);
  const ticks: number[] = [];
  for (let t = 0; t <= durationSec + step; t += step) {
    ticks.push(t);
  }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ width, height }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 bottom-0 border-l border-border/30"
          style={{ left: t * pxPerSec }}
        />
      ))}
    </div>
  );
}

export { tickStep, formatTime };
