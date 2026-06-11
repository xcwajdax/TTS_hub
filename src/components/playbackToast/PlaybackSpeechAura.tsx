import { useCallback, useEffect, useRef } from "react";
import { drawSpeechAura } from "../../lib/playbackSpeechAuraCanvas";
import type { PlaybackVizFramePayload } from "../../lib/playbackToastContract";
import AvatarImage from "../avatars/AvatarImage";

interface Props {
  active: boolean;
  frame: PlaybackVizFramePayload | null;
  sourceColor: string;
  accentColor?: string;
  profileName: string | null;
  voiceAvatarPath: string | null;
  className?: string;
}

const AVATAR_SIZE = 36;

export default function PlaybackSpeechAura({
  active,
  frame,
  sourceColor,
  accentColor = "#7c5cff",
  profileName,
  voiceAvatarPath,
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
      className={`relative w-full h-[4.5rem] rounded-md overflow-hidden bg-panel2/40 border border-border/50 ${className}`}
      role="img"
      aria-label="Wizualizacja mowy"
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AvatarImage
          filePath={voiceAvatarPath}
          fallbackLabel={profileName ?? "?"}
          size={AVATAR_SIZE}
          className="ring-2 ring-panel shadow-md relative z-10"
        />
      </div>
    </div>
  );
}
