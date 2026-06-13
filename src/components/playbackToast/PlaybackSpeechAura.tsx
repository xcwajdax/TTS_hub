import { useCallback, useEffect, useRef } from "react";
import { drawSpeechAura } from "../../lib/playbackSpeechAuraCanvas";
import type { PlaybackVizFramePayload } from "../../lib/playbackToastContract";

interface Props {
  active: boolean;
  frame: PlaybackVizFramePayload | null;
  sourceColor: string;
  accentColor?: string;
  className?: string;
}

export default function PlaybackSpeechAura({
  active,
  frame,
  sourceColor,
  accentColor = "#7c5cff",
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);

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

    const progress =
      frame && frame.duration > 0 ? frame.currentTime / frame.duration : 0;

    drawSpeechAura(ctx, w, h, {
      levels: frame?.levels ?? [],
      progress,
      active: active && !!frame,
      loading: frame?.loading ?? false,
      sourceColor,
      accentColor,
      timeMs: timeRef.current,
    });
  }, [active, frame, sourceColor, accentColor]);

  useEffect(() => {
    let running = true;
    const tick = (ts: number) => {
      if (!running) return;
      timeRef.current = ts;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full h-7 rounded-md overflow-hidden border border-border/30 bg-panel2/20 ${className}`}
      role="img"
      aria-label="Postęp i wizualizacja odtwarzania"
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
