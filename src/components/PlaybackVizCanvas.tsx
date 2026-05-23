import { useCallback, useEffect, useRef } from "react";
import { drawLiveEqualizer } from "../lib/playbackVizCanvas";

interface Props {
  active: boolean;
  levels: number[] | null;
  progress?: number;
  compact?: boolean;
  className?: string;
}

export default function PlaybackVizCanvas({
  active,
  levels,
  progress = 0,
  compact = false,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (active && levels?.length) {
      drawLiveEqualizer(ctx, w, h, levels, progress);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }, [active, levels, progress]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const heightClass = compact ? "h-6" : "h-8";

  return (
    <div
      ref={wrapRef}
      className={`tts-playback-viz relative w-full min-w-0 ${heightClass} rounded-md overflow-hidden ${className}`}
      aria-hidden={!active}
      role="img"
      aria-label={active ? "Wizualizacja odtwarzania" : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
