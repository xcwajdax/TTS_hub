export interface VideoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VideoLayerType =
  | "cover"
  | "karaoke"
  | "footer"
  | "watermark"
  | "image"
  | "shape"
  | "customText"
  | "videoLoop";

export interface VideoLayerBase {
  id: string;
  visible: boolean;
  rect: VideoRect;
}

export interface CoverLayer extends VideoLayerBase {
  type: "cover";
  mode: "profile" | "fixed_image" | "generation_color";
  objectFit: "contain" | "cover";
}

/** How karaoke text moves inside the MP4 layer rect. */
export type KaraokeScrollMode = "classic" | "line-focus" | "smooth";

export interface KaraokeLayer extends VideoLayerBase {
  type: "karaoke";
  source: "minimax_json" | "estimated_text" | "static_title";
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outline: number;
  alignment: 2 | 5 | 8;
  /** Missing on older templates — treat as `"classic"`. */
  scrollMode?: KaraokeScrollMode;
}

export interface FooterLayer extends VideoLayerBase {
  type: "footer";
  template: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface WatermarkLayer extends VideoLayerBase {
  type: "watermark";
  text: string;
  logoPath: string | null;
  opacity: number;
}

export interface ImageLayer extends VideoLayerBase {
  type: "image";
  imagePath: string | null;
  objectFit: "contain" | "cover" | "fill";
  opacity: number;
}

export interface ShapeLayer extends VideoLayerBase {
  type: "shape";
  shapeKind: "rect" | "ellipse";
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

/**
 * Free-form text field. The user types any text and the renderer draws it
 * inside the layer rect using `ffmpeg drawtext` (with the same font fallback
 * chain as the rest of the template). Useful for static captions,
 * short labels, episode numbers, hash tags, calls-to-action, etc.
 */
export interface CustomTextLayer extends VideoLayerBase {
  type: "customText";
  /** Multi-line text; linebreaks preserved. Empty = hide visually. */
  text: string;
  fontName: string;
  fontSize: number;
  color: string;
  /** Add a semi-opaque background box behind the text (highlight card). */
  background: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  align: "left" | "center" | "right";
  /** Vertical alignment inside the layer rect. */
  verticalAlign: "top" | "middle" | "bottom";
  bold: boolean;
  italic: boolean;
}

/**
 * Animated video loop. The user picks a short MP4 (defaults to the bundled
 * `tshub_baner.mp4`) and the renderer overlays it on top of the cover with
 * a continuous rotation around the rect's center. Designed for spinning
 * logos / banners; the source video should be transparent-friendly (PNG
 * with alpha → MP4) or a clipped plate.
 *
 * Implementation notes:
 * - The video is fed as a third ffmpeg input (`-loop 1 -framerate 25 -i …`),
 *   then composed via `rotate=…:c=0x00000000:ow=…:oh=…` and `overlay`.
 * - `rotationSpeed` is rotations per second; `0` = static.
 * - The video is scaled to fit the rect's width (rotated bounding box).
 */
export interface VideoLoopLayer extends VideoLayerBase {
  type: "videoLoop";
  /** Absolute path to the source MP4. `null` = no source selected. */
  videoPath: string | null;
  /** Rotations per second. 0 = static. Default 0.5 (≈ 180°/s). */
  rotationSpeed: number;
  /** Overall opacity, 0..1. */
  opacity: number;
}

export type VideoLayer =
  | CoverLayer
  | KaraokeLayer
  | FooterLayer
  | WatermarkLayer
  | ImageLayer
  | ShapeLayer
  | CustomTextLayer
  | VideoLoopLayer;

export type VideoBackgroundMode = "solid" | "linear" | "radial";

export interface VideoCanvas {
  width: number;
  height: number;
  background: string;
  /** Missing on older templates — treat as `"solid"`. */
  backgroundMode?: VideoBackgroundMode;
  backgroundTo?: string | null;
  /** CSS degrees: 0 = do góry, 90 = w prawo, 180 = w dół. */
  backgroundAngle?: number;
}

export function videoCanvasCssBackground(canvas: VideoCanvas): string {
  const from = canvas.background?.trim() || "#12141a";
  const mode = canvas.backgroundMode ?? "solid";
  const to = canvas.backgroundTo?.trim() || "#000000";
  const angle = Number.isFinite(canvas.backgroundAngle) ? Number(canvas.backgroundAngle) : 180;
  if (mode === "radial") {
    return `radial-gradient(circle at center, ${from}, ${to})`;
  }
  if (mode === "linear") {
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return from;
}

export interface VideoTemplate {
  id: string;
  name: string;
  version: number;
  canvas: VideoCanvas;
  layers: VideoLayer[];
  output: {
    videoCodec: string;
    audioCodec: string;
    audioBitrateK: number;
    tune: string;
  };
}

export interface VideoTemplateMeta {
  id: string;
  name: string;
  updatedAt: number;
  isBuiltin: boolean;
}

export interface VideoExportRecord {
  id: string;
  generationId: string;
  templateId: string;
  filePath: string;
  thumbPath: string | null;
  durationMs: number | null;
  fileSizeBytes: number;
  renderParamsHash: string;
  createdAt: number;
  source: string;
  title: string | null;
  isPrivate?: boolean;
}

export const BUILTIN_WHATSAPP_TEMPLATE_ID = "builtin-whatsapp-karaoke";

export const LAYER_LABELS: Record<VideoLayerType, string> = {
  cover: "Okładka",
  karaoke: "Karaoke",
  footer: "Stopka",
  watermark: "Watermark",
  image: "Obraz",
  shape: "Kształt",
  customText: "Custom tekst",
  videoLoop: "Animowany baner (MP4)",
};
