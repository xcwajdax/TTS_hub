export interface VideoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VideoLayerType = "cover" | "karaoke" | "footer" | "watermark" | "image" | "shape";

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

export interface KaraokeLayer extends VideoLayerBase {
  type: "karaoke";
  source: "minimax_json" | "estimated_text" | "static_title";
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outline: number;
  alignment: 2 | 5 | 8;
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

export type VideoLayer =
  | CoverLayer
  | KaraokeLayer
  | FooterLayer
  | WatermarkLayer
  | ImageLayer
  | ShapeLayer;

export interface VideoTemplate {
  id: string;
  name: string;
  version: number;
  canvas: { width: number; height: number; background: string };
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
}

export const BUILTIN_WHATSAPP_TEMPLATE_ID = "builtin-whatsapp-karaoke";

export const LAYER_LABELS: Record<VideoLayerType, string> = {
  cover: "Okładka",
  karaoke: "Karaoke",
  footer: "Stopka",
  watermark: "Watermark",
  image: "Obraz",
  shape: "Kształt",
};
