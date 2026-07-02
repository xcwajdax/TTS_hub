import { captureViewportSnapshot } from "./capture";
import {
  getTransitionConfigForSkin,
  normalizeSkinTransitionConfig,
  shouldPlaySkinTransition,
} from "./config";
import { computeTileFlips, renderTransitionFrame } from "./renderFrame";
import type { PlaySkinTransitionOptions } from "./types";
import { buildTileGrid, tileFlipProgress } from "./waveMath";
import { BUILTIN_SKINS } from "../builtin";

function manifestForSkin(skinId: string) {
  return BUILTIN_SKINS.find((s) => s.manifest.id === skinId)?.manifest;
}

export type TransitionRunner = (options: PlaySkinTransitionOptions) => Promise<void>;

export function createTransitionRunner(
  getRoot: () => HTMLElement | null,
  mountOverlay: (canvas: HTMLCanvasElement) => () => void,
): TransitionRunner {
  let running = false;

  return async (options: PlaySkinTransitionOptions) => {
    if (running) return;

    const targetManifest = manifestForSkin(options.toSkinId);
    const config = normalizeSkinTransitionConfig(
      { ...getTransitionConfigForSkin(targetManifest, options.toSkinId), ...options.config },
      options.toSkinId,
    );

    if (!shouldPlaySkinTransition(config)) {
      await options.applySkin();
      return;
    }

    const root = getRoot();
    if (!root) {
      await options.applySkin();
      return;
    }

    running = true;
    let unmount: (() => void) | undefined;
    let skinApplied = false;

    try {
      const snapshot = await captureViewportSnapshot(root, config.captureScale);
      await options.applySkin();
      skinApplied = true;

      const rect = root.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width < 8 || height < 8) return;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.dataset.skinTransitionOverlay = "true";
      canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      unmount = mountOverlay(canvas);

      const tiles = buildTileGrid(width, height, config.pattern);
      const tileFlips = new Float32Array(tiles.length);
      const origin = { x: options.origin.x, y: options.origin.y };

      const flipAt = (elapsedMs: number) => {
        computeTileFlips(
          tiles,
          tileFlips,
          origin,
          elapsedMs,
          config,
          (tile, orig, elapsed, cfg) => tileFlipProgress(tile, orig, elapsed, cfg, width, height),
        );
      };

      const paint = (elapsedMs: number) => {
        flipAt(elapsedMs);
        renderTransitionFrame({
          ctx,
          snapshot,
          tiles,
          tileFlips,
          config,
          elapsedMs,
          width,
          height,
        });
      };

      const start = performance.now();

      paint(0);

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const elapsed = now - start;
          paint(elapsed);

          if (elapsed < config.durationMs) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    } catch {
      if (!skinApplied) await options.applySkin();
    } finally {
      unmount?.();
      running = false;
    }
  };
}
