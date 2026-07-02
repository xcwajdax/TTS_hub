import { hashSeed } from "./waveMath";
import type { SkinTransitionConfig, TransitionTile } from "./types";

const MATRIX_CHARS = "アイウエオカキクケコ0123456789ABCDEF";

function drawMatrixBack(
  ctx: CanvasRenderingContext2D,
  tile: TransitionTile,
  flip: number,
): void {
  const cx = tile.x + tile.w / 2;
  const cy = tile.y + tile.h / 2;
  const intensity = Math.sin(flip * Math.PI);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = `rgba(0, ${Math.floor(180 + intensity * 75)}, ${Math.floor(40 + intensity * 40)}, ${0.55 + intensity * 0.35})`;
  ctx.fillRect(-tile.w / 2, -tile.h / 2, tile.w, tile.h);

  ctx.font = `${Math.max(8, Math.floor(tile.h * 0.55))}px Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const count = Math.max(1, Math.floor(tile.w / 8));
  for (let i = 0; i < count; i++) {
    const ch = MATRIX_CHARS[Math.floor(hashSeed(tile.seed + i * 7) * MATRIX_CHARS.length)]!;
    const ox = (i - (count - 1) / 2) * (tile.w / count);
    ctx.fillStyle = `rgba(120, 255, 140, ${0.35 + hashSeed(tile.seed + i) * 0.5})`;
    ctx.fillText(ch, ox, (hashSeed(tile.seed + i * 3) - 0.5) * tile.h * 0.3);
  }
  ctx.restore();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  snapshot: HTMLCanvasElement,
  tile: TransitionTile,
  flip: number,
  config: SkinTransitionConfig,
): void {
  if (flip <= 0) {
    ctx.drawImage(snapshot, tile.sx, tile.sy, tile.sw, tile.sh, tile.x, tile.y, tile.w, tile.h);
    return;
  }
  if (flip >= 1) return;

  const cx = tile.x + tile.w / 2;
  const cy = tile.y + tile.h / 2;
  const angle = flip * Math.PI * 0.5;
  const lift = Math.sin(flip * Math.PI) * config.lift;
  const skew = (hashSeed(tile.seed + 11) - 0.5) * 0.35;
  const scaleY = Math.cos(angle);

  ctx.save();
  ctx.translate(cx, cy - lift);
  ctx.transform(1, skew * scaleY, 0, scaleY, 0, 0);

  if (flip < 0.5) {
    ctx.drawImage(
      snapshot,
      tile.sx,
      tile.sy,
      tile.sw,
      tile.sh,
      -tile.w / 2,
      -tile.h / 2,
      tile.w,
      tile.h,
    );
  } else if (config.matrixGlyphs) {
    drawMatrixBack(ctx, tile, flip);
  } else {
    ctx.globalAlpha = 1 - (flip - 0.5) * 2;
    ctx.drawImage(
      snapshot,
      tile.sx,
      tile.sy,
      tile.sw,
      tile.sh,
      -tile.w / 2,
      -tile.h / 2,
      tile.w,
      tile.h,
    );
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export interface TransitionFrameInput {
  ctx: CanvasRenderingContext2D;
  snapshot: HTMLCanvasElement;
  tiles: TransitionTile[];
  tileFlips: Float32Array;
  config: SkinTransitionConfig;
  elapsedMs: number;
  width: number;
  height: number;
}

export function renderTransitionFrame(input: TransitionFrameInput): void {
  const { ctx, snapshot, tiles, tileFlips, config, elapsedMs, width, height } = input;
  ctx.clearRect(0, 0, width, height);

  const fadeStart = config.durationMs * 0.94;
  const overlayAlpha =
    elapsedMs > fadeStart
      ? Math.max(0, 1 - (elapsedMs - fadeStart) / (config.durationMs - fadeStart))
      : 1;

  if (overlayAlpha <= 0) return;

  ctx.globalAlpha = overlayAlpha;

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    const flip = tileFlips[i] ?? 0;
    drawTile(ctx, snapshot, tile, flip, config);
  }

  ctx.globalAlpha = 1;
}

export function computeTileFlips(
  tiles: TransitionTile[],
  tileFlips: Float32Array,
  origin: { x: number; y: number },
  elapsedMs: number,
  config: SkinTransitionConfig,
  flipFn: (
    tile: TransitionTile,
    origin: { x: number; y: number },
    elapsedMs: number,
    config: SkinTransitionConfig,
  ) => number,
): void {
  for (let i = 0; i < tiles.length; i++) {
    tileFlips[i] = flipFn(tiles[i]!, origin, elapsedMs, config);
  }
}
