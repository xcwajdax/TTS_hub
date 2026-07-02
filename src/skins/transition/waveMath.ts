import type { SkinTransitionConfig, SkinTransitionOrigin, TransitionTile } from "./types";

export function hashSeed(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function tileFlipProgress(
  tile: TransitionTile,
  origin: SkinTransitionOrigin,
  elapsedMs: number,
  config: SkinTransitionConfig,
  viewportW: number,
  viewportH: number,
): number {
  const cx = tile.x + tile.w * 0.5;
  const cy = tile.y + tile.h * 0.5;
  const dx = cx - origin.x;
  const dy = cy - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const diagonal = Math.hypot(viewportW, viewportH);
  const noiseOffset = (hashSeed(tile.seed) - 0.5) * config.noise * diagonal * 0.14;

  // Wave crosses the viewport in ~waveTravelRatio of durationMs (waveSpeed scales it).
  const travelRatio = 0.86;
  const speedMul = Math.max(0.35, config.waveSpeed / 400);
  const travelMs = (config.durationMs * travelRatio) / speedMul;
  const waveProgress = Math.min(1, elapsedMs / travelMs);
  const waveFront = waveProgress * (diagonal + diagonal * config.falloff * 0.55);
  const falloffPx = Math.max(32, config.falloff * diagonal * 0.32);
  const raw = (waveFront - dist + noiseOffset) / falloffPx;
  return Math.min(1, Math.max(0, raw));
}

export function buildTileGrid(
  width: number,
  height: number,
  pattern: SkinTransitionConfig["pattern"],
): TransitionTile[] {
  const tiles: TransitionTile[] = [];
  let cols: number;
  let rows: number;

  switch (pattern) {
    case "matrix-columns":
      cols = Math.max(12, Math.round(width / 28));
      rows = Math.max(10, Math.round(height / 14));
      break;
    case "squares":
      cols = Math.max(10, Math.round(width / 52));
      rows = Math.max(8, Math.round(height / 52));
      break;
    case "bricks":
    default:
      cols = Math.max(12, Math.round(width / 44));
      rows = Math.max(9, Math.round(height / 22));
      break;
  }

  const baseW = width / cols;
  const baseH = height / rows;
  let seed = 0;

  for (let row = 0; row < rows; row++) {
    const brickOffset = pattern === "bricks" && row % 2 === 1 ? baseW * 0.5 : 0;
    for (let col = 0; col < cols; col++) {
      const x = col * baseW + brickOffset;
      if (x >= width) continue;
      const w = Math.min(baseW * 1.02, width - x);
      const y = row * baseH;
      const h = Math.min(baseH * 1.02, height - y);
      if (w < 2 || h < 2) continue;

      tiles.push({
        x,
        y,
        w,
        h,
        sx: x,
        sy: y,
        sw: w,
        sh: h,
        seed: seed++,
      });
    }
  }

  return tiles;
}
