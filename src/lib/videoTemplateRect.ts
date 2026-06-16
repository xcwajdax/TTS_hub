import type { VideoLayer, VideoRect, VideoTemplate } from "../types/videoTemplate";

const MIN_SIZE = 8;

/** Backend (Rust) expects u32 rects — round and clamp after drag/resize or manual edit. */
export function normalizeVideoRect(
  rect: VideoRect,
  canvasWidth: number,
  canvasHeight: number,
): VideoRect {
  const width = Math.max(MIN_SIZE, Math.min(Math.round(rect.width), canvasWidth));
  const height = Math.max(MIN_SIZE, Math.min(Math.round(rect.height), canvasHeight));
  const x = Math.max(0, Math.min(Math.round(rect.x), canvasWidth - width));
  const y = Math.max(0, Math.min(Math.round(rect.y), canvasHeight - height));
  return { x, y, width, height };
}

export function normalizeVideoTemplate(template: VideoTemplate): VideoTemplate {
  const { width: cw, height: ch } = template.canvas;
  return {
    ...template,
    layers: template.layers.map((layer) => ({
      ...layer,
      rect: normalizeVideoRect(layer.rect, cw, ch),
    })),
  };
}

export function normalizeLayerPatch(
  patch: Partial<VideoLayer>,
  layer: VideoLayer,
  canvasWidth: number,
  canvasHeight: number,
): Partial<VideoLayer> {
  if (!patch.rect) return patch;
  return {
    ...patch,
    rect: normalizeVideoRect({ ...layer.rect, ...patch.rect }, canvasWidth, canvasHeight),
  };
}
