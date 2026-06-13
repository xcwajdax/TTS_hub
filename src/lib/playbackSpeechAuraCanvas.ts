import { hexToRgba } from "./historySourceUi";

export interface SpeechAuraDrawOptions {
  levels: number[];
  progress: number;
  active: boolean;
  loading: boolean;
  sourceColor: string;
  accentColor: string;
  timeMs: number;
}

function rms(levels: number[]): number {
  if (levels.length === 0) return 0;
  let sum = 0;
  for (const v of levels) sum += v * v;
  return Math.sqrt(sum / levels.length);
}

/** Compact row: subtle progress fill + soft wave overlay (no avatar). */
export function drawSpeechAura(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: SpeechAuraDrawOptions,
) {
  const { levels, progress, active, loading, sourceColor, accentColor, timeMs } = opts;
  ctx.clearRect(0, 0, w, h);

  const energy = active ? rms(levels) : loading ? 0.06 : 0.02;
  const pulse = 0.015 * Math.sin(timeMs * 0.006);
  const clampedProgress = Math.min(1, Math.max(0, progress));

  ctx.fillStyle = hexToRgba(sourceColor, 0.05);
  ctx.fillRect(0, 0, w, h);

  const fillW = w * clampedProgress;
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(0, 0, Math.max(fillW, 1), 0);
    grad.addColorStop(0, hexToRgba(sourceColor, 0.14 + energy * 0.12 + pulse));
    grad.addColorStop(1, hexToRgba(sourceColor, 0.1 + energy * 0.1 + pulse));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, fillW, h);
  }

  if (active || loading) {
    const speed = 0.018;
    const ribbons = [
      { phase: 0, weight: 1, y: h * 0.38 },
      { phase: 1.8, weight: 0.55, y: h * 0.62 },
    ];

    for (const ribbon of ribbons) {
      const amp = h * (0.06 + energy * 0.22 + pulse * 0.3) * ribbon.weight;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const t = x / w;
        const wave =
          Math.sin(t * Math.PI * 4 + timeMs * speed + ribbon.phase) * amp +
          Math.sin(t * Math.PI * 7 + timeMs * speed * 1.2) * amp * 0.35;
        const y = ribbon.y + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(accentColor, 0.12 + energy * 0.18);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  if (fillW > 0) {
    ctx.fillStyle = hexToRgba(sourceColor, 0.22);
    ctx.fillRect(Math.max(0, fillW - 1), 0, 1, h);
  }
}
