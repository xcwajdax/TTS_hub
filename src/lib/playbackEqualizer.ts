const BAR_COUNT = 16;

/** Widoczny equalizer reagujący na dane FFT z analizatora. */
export function drawPlaybackEqualizer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frequencyData: Uint8Array,
  playing: boolean,
  level: number,
): void {
  ctx.clearRect(0, 0, width, height);

  const gap = Math.max(2, width * 0.012);
  const barW = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
  const maxH = height * 0.92;
  const amp = Math.min(1, Math.max(0, level));

  for (let i = 0; i < BAR_COUNT; i++) {
    const idx = Math.min(
      frequencyData.length - 1,
      Math.floor(((i + 0.5) / BAR_COUNT) * frequencyData.length),
    );
    const raw = frequencyData[idx] / 255;
    const idlePulse = playing ? 0 : 0.12 + 0.06 * Math.sin(i * 0.9);
    const energy = playing ? raw * (0.45 + amp * 0.55) : idlePulse * 0.35;
    const barH = Math.max(3, maxH * energy);
    const x = i * (barW + gap);
    const y = height - barH;

    const grad = ctx.createLinearGradient(0, y, 0, height);
    if (playing) {
      grad.addColorStop(0, "#67e8f9");
      grad.addColorStop(0.55, "#7c5cff");
      grad.addColorStop(1, "rgba(124, 92, 255, 0.35)");
    } else {
      grad.addColorStop(0, "rgba(124, 92, 255, 0.55)");
      grad.addColorStop(1, "rgba(124, 92, 255, 0.15)");
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = Math.min(barW / 2, 3);
    ctx.roundRect(x, y, barW, barH, r);
    ctx.fill();
  }
}
