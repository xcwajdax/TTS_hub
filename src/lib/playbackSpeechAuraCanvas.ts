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

function bandEnergy(levels: number[], start: number, end: number): number {
  if (levels.length === 0) return 0;
  const i0 = Math.floor(start * levels.length);
  const i1 = Math.max(i0 + 1, Math.ceil(end * levels.length));
  let sum = 0;
  let n = 0;
  for (let i = i0; i < i1 && i < levels.length; i++) {
    sum += levels[i];
    n++;
  }
  return n > 0 ? sum / n : 0;
}

export function drawSpeechAura(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: SpeechAuraDrawOptions,
) {
  const { levels, progress, active, loading, sourceColor, accentColor, timeMs } = opts;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const baseR = Math.min(w, h) * 0.22;
  const energy = active ? rms(levels) : loading ? 0.15 : 0.08;
  const breathe = 0.04 * Math.sin(timeMs * 0.002);

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
  bg.addColorStop(0, hexToRgba(accentColor, 0.12 + energy * 0.2));
  bg.addColorStop(0.55, hexToRgba(sourceColor, 0.06 + energy * 0.1));
  bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const ribbons = [
    { phase: 0, amp: bandEnergy(levels, 0, 0.35), y: h * 0.28, alpha: 0.55 },
    { phase: 1.4, amp: bandEnergy(levels, 0.25, 0.65), y: h * 0.5, alpha: 0.7 },
    { phase: 2.8, amp: bandEnergy(levels, 0.55, 1), y: h * 0.72, alpha: 0.45 },
  ];

  for (const ribbon of ribbons) {
    const amp = (ribbon.amp * 0.65 + breathe) * h * 0.18;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const t = x / w;
      const wave =
        Math.sin(t * Math.PI * 4 + timeMs * 0.004 + ribbon.phase) * amp +
        Math.sin(t * Math.PI * 7 + timeMs * 0.003) * amp * 0.35;
      const y = ribbon.y + wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hexToRgba(accentColor, ribbon.alpha * (0.35 + energy));
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const auraR = baseR + energy * baseR * 1.8 + breathe * baseR;
  const aura = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, auraR * 2.2);
  aura.addColorStop(0, hexToRgba(accentColor, 0.35 + energy * 0.4));
  aura.addColorStop(0.45, hexToRgba(sourceColor, 0.2 + energy * 0.25));
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, auraR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const ringR = baseR * 1.35;
  ctx.lineWidth = 3;
  ctx.strokeStyle = hexToRgba(sourceColor, 0.2);
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  if (progress > 0) {
    const start = -Math.PI / 2;
    const end = start + Math.min(1, progress) * Math.PI * 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = sourceColor;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, start, end);
    ctx.stroke();
  }

  ctx.fillStyle = hexToRgba(accentColor, 0.15 + energy * 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
  ctx.fill();
}
