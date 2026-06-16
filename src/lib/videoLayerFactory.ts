import type { VideoLayer, VideoLayerType } from "../types/videoTemplate";

let layerCounter = 0;

function nextLayerId(type: VideoLayerType): string {
  layerCounter += 1;
  return `${type}-${Date.now()}-${layerCounter}`;
}

export function createDefaultLayer(type: VideoLayerType, canvasW: number, canvasH: number): VideoLayer {
  const cx = Math.round(canvasW * 0.15);
  const cy = Math.round(canvasH * 0.15);
  const base = {
    id: nextLayerId(type),
    visible: true,
    rect: { x: cx, y: cy, width: Math.round(canvasW * 0.35), height: Math.round(canvasH * 0.25) },
  };

  switch (type) {
    case "cover":
      return {
        ...base,
        type: "cover",
        mode: "profile",
        objectFit: "contain",
      };
    case "karaoke":
      return {
        ...base,
        type: "karaoke",
        source: "minimax_json",
        fontName: "Arial",
        fontSize: 40,
        primaryColor: "#FFFFFF",
        highlightColor: "#FACC15",
        outline: 2,
        alignment: 2,
      };
    case "footer":
      return {
        ...base,
        type: "footer",
        rect: { x: 0, y: canvasH - 40, width: canvasW, height: 36 },
        template: "{{voice}} · {{model}} · {{duration}} · TTS Hub",
        fontSize: 18,
        color: "#A8B0C0",
        align: "center",
      };
    case "watermark":
      return {
        ...base,
        type: "watermark",
        rect: { x: canvasW - 96, y: 16, width: 80, height: 56 },
        text: "TTS Hub",
        logoPath: null,
        opacity: 0.38,
      };
    case "image":
      return {
        ...base,
        type: "image",
        imagePath: null,
        objectFit: "contain",
        opacity: 1,
      };
    case "shape":
      return {
        ...base,
        type: "shape",
        shapeKind: "rect",
        fill: "#6EE7B780",
        stroke: "#6EE7B7",
        strokeWidth: 2,
        opacity: 0.85,
      };
  }
}

export const ADD_LAYER_OPTIONS: { type: VideoLayerType; label: string }[] = [
  { type: "image", label: "Obraz (raster)" },
  { type: "shape", label: "Kształt (wektor)" },
  { type: "cover", label: "Okładka" },
  { type: "karaoke", label: "Karaoke" },
  { type: "footer", label: "Stopka" },
  { type: "watermark", label: "Watermark" },
];
