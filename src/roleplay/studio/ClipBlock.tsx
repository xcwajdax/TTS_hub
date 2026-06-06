import { useRef, useEffect } from "react";
import type { TimelineClip } from "../types";

interface Props {
  clip: TimelineClip;
  pxPerSec: number;
  trackHeight: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (deltaSec: number) => void;
  onTrimStart: (deltaSec: number) => void;
  onTrimEnd: (deltaSec: number) => void;
  peaks?: Float32Array | null;
}

export default function ClipBlock({
  clip,
  pxPerSec,
  trackHeight,
  selected,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
  peaks,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duration = Number.isFinite(clip.durationSec) ? clip.durationSec : 1;
  const start = Number.isFinite(clip.startSec) ? clip.startSec : 0;
  const width = Math.max(24, duration * pxPerSec);
  const left = start * pxPerSec;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = selected ? "#38bdf8" : "#64748b";
    const mid = c.height / 2;
    const step = Math.max(1, Math.floor(peaks.length / c.width));
    for (let x = 0; x < c.width; x++) {
      const i = x * step;
      const v = peaks[i] ?? 0;
      const h = Math.max(2, v * mid * 0.9);
      ctx.fillRect(x, mid - h, 1, h * 2);
    }
  }, [peaks, selected, width, trackHeight]);

  return (
    <div
      className={`absolute top-1 rounded border overflow-hidden cursor-grab active:cursor-grabbing bg-accent/20 ${
        selected ? "border-accent ring-1 ring-accent" : "border-border"
      }`}
      style={{ left, width, height: trackHeight - 8, minWidth: 24 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <canvas ref={canvasRef} width={width} height={trackHeight - 8} className="w-full h-full opacity-80" />
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-accent/30"
        onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX;
          const onMoveEv = (ev: MouseEvent) => onTrimStart((ev.clientX - startX) / pxPerSec);
          const up = () => {
            window.removeEventListener("mousemove", onMoveEv);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", onMoveEv);
          window.addEventListener("mouseup", up);
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-accent/30"
        onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX;
          const onMoveEv = (ev: MouseEvent) => onTrimEnd((ev.clientX - startX) / pxPerSec);
          const up = () => {
            window.removeEventListener("mousemove", onMoveEv);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", onMoveEv);
          window.addEventListener("mouseup", up);
        }}
      />
      <div
        className="absolute inset-0"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).classList.contains("cursor-ew-resize")) return;
          const startX = e.clientX;
          const onMoveEv = (ev: MouseEvent) => onMove((ev.clientX - startX) / pxPerSec);
          const up = () => {
            window.removeEventListener("mousemove", onMoveEv);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", onMoveEv);
          window.addEventListener("mouseup", up);
        }}
      />
    </div>
  );
}
