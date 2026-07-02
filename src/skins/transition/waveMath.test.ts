import { describe, expect, it } from "vitest";
import { buildTileGrid, hashSeed, tileFlipProgress } from "./waveMath";
import type { SkinTransitionConfig, TransitionTile } from "./types";

const baseConfig: SkinTransitionConfig = {
  enabled: true,
  pattern: "bricks",
  durationMs: 3800,
  waveSpeed: 400,
  falloff: 0.42,
  noise: 0.18,
  lift: 36,
  captureScale: 0.85,
};

const tile: TransitionTile = {
  x: 100,
  y: 100,
  w: 40,
  h: 20,
  sx: 100,
  sy: 100,
  sw: 40,
  sh: 20,
  seed: 3,
};

const VIEW_W = 1280;
const VIEW_H = 720;

describe("tileFlipProgress", () => {
  it("returns 0 before wave reaches tile", () => {
    const p = tileFlipProgress(tile, { x: 0, y: 0 }, 0, baseConfig, VIEW_W, VIEW_H);
    expect(p).toBe(0);
  });

  it("increases with elapsed time at fixed distance", () => {
    const early = tileFlipProgress(tile, { x: 0, y: 0 }, 400, baseConfig, VIEW_W, VIEW_H);
    const late = tileFlipProgress(tile, { x: 0, y: 0 }, 2000, baseConfig, VIEW_W, VIEW_H);
    expect(late).toBeGreaterThan(early);
  });

  it("clamps to 1 after wave passes", () => {
    const p = tileFlipProgress(tile, { x: 0, y: 0 }, 8000, baseConfig, VIEW_W, VIEW_H);
    expect(p).toBe(1);
  });
});

describe("buildTileGrid", () => {
  it("produces tiles covering the viewport", () => {
    const tiles = buildTileGrid(400, 300, "squares");
    expect(tiles.length).toBeGreaterThan(20);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(401);
      expect(t.y + t.h).toBeLessThanOrEqual(301);
    }
  });

  it("brick pattern offsets alternate rows", () => {
    const tiles = buildTileGrid(800, 220, "bricks");
    const baseH = 220 / Math.max(9, Math.round(220 / 22));
    const row0 = tiles.filter((t) => t.y < baseH * 0.5);
    const row1 = tiles.filter((t) => t.y >= baseH * 0.5 && t.y < baseH * 1.5);
    if (row0.length > 0 && row1.length > 0) {
      const minX0 = Math.min(...row0.map((t) => t.x));
      const minX1 = Math.min(...row1.map((t) => t.x));
      expect(minX1).toBeGreaterThan(minX0);
    }
  });
});

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed(42)).toBe(hashSeed(42));
  });
});
