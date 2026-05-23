import { getPlaybackVizColors } from "./playbackVizColors";

export function drawLiveEqualizer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  levels: number[],
  progress = 0,
) {
  const colors = getPlaybackVizColors();
  ctx.clearRect(0, 0, w, h);

  const count = levels.length;
  if (count === 0) return;

  const barW = w / count;
  const gap = Math.max(0.5, barW * 0.22);
  const scale = h * 0.82;
  const playedBars = Math.floor(progress * count);

  levels.forEach((level, i) => {
    const barH = Math.max(2, level * scale);
    const x = i * barW + gap / 2;
    const y = (h - barH) / 2;
    const bw = Math.max(1, barW - gap);

    ctx.fillStyle = i < playedBars ? colors.equalizerActive : colors.equalizerIdle;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, bw, barH, 1);
    } else {
      ctx.rect(x, y, bw, barH);
    }
    ctx.fill();
  });

  if (progress > 0 && progress < 1) {
    const px = progress * w;
    ctx.strokeStyle = colors.progressLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
}
