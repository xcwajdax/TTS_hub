import type { TimelineViewMode } from "./timelineView";
import { readSkinCanvasColors } from "../skins/skinColors";

function drawPlayedProgressLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  color: string,
) {
  if (progress <= 0 || progress >= 1) return;
  const px = progress * w;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, h);
  ctx.stroke();
}

function drawEmptyPlaceholder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  const mid = h / 2;
  for (let x = 0; x < w; x += 5) {
    ctx.fillRect(x, mid - 1, 2, 2);
  }
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peaks: number[],
  progress: number,
  detailed: boolean,
) {
  const colors = readSkinCanvasColors();
  const barW = w / peaks.length;
  const gapRatio = detailed ? 0.12 : 0.2;
  const gap = Math.max(0.35, barW * gapRatio);
  const playedBars = Math.floor(progress * peaks.length);
  const scale = h * (detailed ? 0.82 : 0.72);

  peaks.forEach((peak, i) => {
    const barH = Math.max(detailed ? 1 : 2, peak * scale);
    const x = i * barW + gap / 2;
    const y = (h - barH) / 2;
    const bw = Math.max(detailed ? 0.75 : 1, barW - gap);

    ctx.fillStyle = i < playedBars ? colors.played : colors.unplayed;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, bw, barH, detailed ? 0.5 : 1);
    } else {
      ctx.rect(x, y, bw, barH);
    }
    ctx.fill();
  });

  drawPlayedProgressLine(ctx, w, h, progress, colors.progressLine);
}

function drawLineWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peaks: number[],
  progress: number,
) {
  const colors = readSkinCanvasColors();
  const mid = h / 2;
  const scale = h * 0.44;
  const step = w / Math.max(1, peaks.length - 1);
  const playedIndex = progress * (peaks.length - 1);

  const buildPath = (from: number, to: number, upper: boolean) => {
    ctx.beginPath();
    let started = false;
    for (let i = from; i <= to; i++) {
      const peak = peaks[i] ?? 0;
      const x = i * step;
      const y = upper ? mid - peak * scale : mid + peak * scale;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  };

  const split = Math.min(peaks.length - 1, Math.max(0, Math.floor(playedIndex)));

  if (split > 0) {
    ctx.strokeStyle = colors.played;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    buildPath(0, split, true);
    ctx.stroke();
    buildPath(0, split, false);
    ctx.stroke();
  }

  if (split < peaks.length - 1) {
    ctx.strokeStyle = colors.unplayed;
    ctx.lineWidth = 1.25;
    buildPath(split, peaks.length - 1, true);
    ctx.stroke();
    buildPath(split, peaks.length - 1, false);
    ctx.stroke();
  }

  ctx.strokeStyle = colors.unplayed;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawPlayedProgressLine(ctx, w, h, progress, colors.progressLine);
}

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peaks: number[] | null,
  progress = 0,
  mode: TimelineViewMode = "bars",
) {
  const colors = readSkinCanvasColors();
  ctx.clearRect(0, 0, w, h);

  if (!peaks?.length) {
    drawEmptyPlaceholder(ctx, w, h, colors.empty);
    return;
  }

  switch (mode) {
    case "bars-detailed":
      drawBars(ctx, w, h, peaks, progress, true);
      break;
    case "line":
      drawLineWaveform(ctx, w, h, peaks, progress);
      break;
    default:
      drawBars(ctx, w, h, peaks, progress, false);
      break;
  }
}
