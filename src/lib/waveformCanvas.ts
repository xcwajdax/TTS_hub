export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  peaks: number[] | null,
  progress = 0,
) {
  ctx.clearRect(0, 0, w, h);

  if (!peaks?.length) {
    ctx.fillStyle = "rgba(138, 147, 166, 0.12)";
    const mid = h / 2;
    for (let x = 0; x < w; x += 5) {
      ctx.fillRect(x, mid - 1, 2, 2);
    }
    return;
  }

  const barW = w / peaks.length;
  const gap = Math.max(0.5, barW * 0.2);
  const playedBars = Math.floor(progress * peaks.length);
  const scale = h * 0.72;

  peaks.forEach((peak, i) => {
    const barH = Math.max(2, peak * scale);
    const x = i * barW + gap / 2;
    const y = (h - barH) / 2;
    const bw = Math.max(1, barW - gap);

    ctx.fillStyle =
      i < playedBars ? "rgba(124, 92, 255, 0.85)" : "rgba(138, 147, 166, 0.35)";
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
    ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
}
