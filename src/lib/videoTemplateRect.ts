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

const LAYER_FIELD_ALIASES: Record<string, string> = {
  font_name: "fontName",
  font_size: "fontSize",
  primary_color: "primaryColor",
  highlight_color: "highlightColor",
  scroll_mode: "scrollMode",
  object_fit: "objectFit",
  logo_path: "logoPath",
  image_path: "imagePath",
  shape_kind: "shapeKind",
  stroke_width: "strokeWidth",
};

const CANVAS_FIELD_ALIASES: Record<string, string> = {
  background_mode: "backgroundMode",
  background_to: "backgroundTo",
  background_angle: "backgroundAngle",
};

function liftAliases<T extends Record<string, unknown>>(raw: T, aliases: Record<string, string>): T {
  const out: Record<string, unknown> = { ...raw };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (snake in out) {
      if (out[camel] === undefined || out[camel] === null) {
        out[camel] = out[snake];
      }
      delete out[snake];
    }
  }
  return out as T;
}

export function canonicalizeVideoLayer(layer: VideoLayer): VideoLayer {
  return liftAliases(layer as unknown as Record<string, unknown>, LAYER_FIELD_ALIASES) as unknown as VideoLayer;
}

export function normalizeVideoTemplate(template: VideoTemplate): VideoTemplate {
  const { width: cw, height: ch } = template.canvas;
  const canvas = liftAliases(
    template.canvas as unknown as Record<string, unknown>,
    CANVAS_FIELD_ALIASES,
  ) as unknown as VideoTemplate["canvas"];
  return {
    ...template,
    canvas,
    layers: template.layers.map((layer) => {
      const canon = canonicalizeVideoLayer(layer);
      return {
        ...canon,
        rect: normalizeVideoRect(canon.rect, cw, ch),
      };
    }),
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
