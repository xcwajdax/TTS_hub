import { useRef, useEffect } from "react";
import type { TimelineClip } from "../types";

interface Props {
  clip: TimelineClip;
  color: string;
  pxPerSec: number;
  trackHeight: number;
  selected: boolean;
  peaks?: Float32Array | null;
  onSelect: () => void;
  onMove: (deltaSec: number) => void;
  onTrimStart: (deltaSec: number) => void;
  onTrimEnd: (deltaSec: number) => void;
  onDragEnd: () => void;
}

const HANDLE_W = 8;

export default function ClipBlock({
  clip,
  color,
  pxPerSec,
  trackHeight,
  selected,
  peaks,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
  onDragEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duration = Number.isFinite(clip.durationSec) ? clip.durationSec : 1;
  const start = Number.isFinite(clip.startSec) ? clip.startSec : 0;
  const width = Math.max(24, duration * pxPerSec);
  const left = start * pxPerSec;
  const blockH = trackHeight - 8;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.ceil(width * dpr));
    const ch = Math.max(1, Math.ceil(blockH * dpr));
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, blockH);

    ctx.fillStyle = `${color}40`;
    ctx.fillRect(0, 0, width, blockH);

    if (!peaks || peaks.length === 0) return;

    const mid = blockH / 2;
    ctx.fillStyle = selected ? "#ffffff" : `${color}`;
    const step = peaks.length / Math.max(1, width);
    for (let x = 0; x < width; x++) {
      const i = Math.min(peaks.length - 1, Math.floor(x * step));
      const v = peaks[i] ?? 0;
      const h = Math.max(2, v * mid * 0.92);
      ctx.globalAlpha = selected ? 0.95 : 0.75;
      ctx.fillRect(x, mid - h, 1, h * 2);
    }
    ctx.globalAlpha = 1;
  }, [peaks, selected, width, blockH, color]);

  const bindDrag = (
    onDelta: (d: number) => void,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const onMoveEv = (ev: MouseEvent) => onDelta((ev.clientX - startX) / pxPerSec);
    const up = () => {
      window.removeEventListener("mousemove", onMoveEv);
      window.removeEventListener("mouseup", up);
      onDragEnd();
    };
    window.addEventListener("mousemove", onMoveEv);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      className={`absolute top-1 rounded overflow-hidden cursor-grab active:cursor-grabbing ${
        selected ? "ring-2 ring-accent z-10" : "z-[1]"
      }`}
      style={{
        left,
        width,
        height: blockH,
        minWidth: 24,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: color,
        backgroundColor: `${color}18`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full pointer-events-none" style={{ width, height: blockH }} />
      <div
        className="absolute left-0 top-0 bottom-0 z-20 cursor-ew-resize hover:bg-white/20"
        style={{ width: HANDLE_W }}
        onMouseDown={(e) => bindDrag(onTrimStart, e)}
      />
      <div
        className="absolute right-0 top-0 bottom-0 z-20 cursor-ew-resize hover:bg-white/20"
        style={{ width: HANDLE_W }}
        onMouseDown={(e) => bindDrag(onTrimEnd, e)}
      />
      <div
        className="absolute top-0 bottom-0 z-10 cursor-grab active:cursor-grabbing"
        style={{ left: HANDLE_W, right: HANDLE_W }}
        onMouseDown={(e) => bindDrag(onMove, e)}
      />
    </div>
  );
}
