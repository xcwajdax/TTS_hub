import type { VideoLayer, VideoLayerType } from "../../types/videoTemplate";
import { LAYER_LABELS } from "../../types/videoTemplate";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

const LAYER_COLORS: Record<VideoLayerType, string> = {
  cover: "rgba(96,165,250,0.35)",
  karaoke: "rgba(250,204,21,0.35)",
  footer: "rgba(167,139,250,0.35)",
  watermark: "rgba(148,163,184,0.35)",
  image: "rgba(52,211,153,0.35)",
  shape: "rgba(244,114,182,0.35)",
};

interface Props {
  layer: VideoLayer;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (handle: string, e: React.PointerEvent) => void;
}

export default function VideoLayerBox({
  layer,
  scale,
  selected,
  onSelect,
  onMoveStart,
  onResizeStart,
}: Props) {
  if (!layer.visible) return null;

  const style: React.CSSProperties = {
    left: layer.rect.x * scale,
    top: layer.rect.y * scale,
    width: layer.rect.width * scale,
    height: layer.rect.height * scale,
    background: LAYER_COLORS[layer.type],
    borderColor: selected ? "var(--color-accent, #6ee7b7)" : "rgba(255,255,255,0.35)",
  };

  return (
    <div
      className={[
        "video-layer-box absolute border-2 rounded-sm cursor-move select-none",
        selected ? "ring-1 ring-accent/60 z-20" : "z-10",
      ].join(" ")}
      style={style}
      onPointerDown={(e) => {
        onSelect();
        onMoveStart(e);
      }}
    >
      <span className="absolute top-0 left-0 text-[9px] px-1 py-0.5 bg-black/50 text-white rounded-br pointer-events-none">
        {LAYER_LABELS[layer.type]}
      </span>
      {layer.type === "karaoke" && (
        <div className="absolute inset-2 flex items-end justify-center text-[10px] text-white/80 text-center pointer-events-none">
          Przykładowa linia karaoke…
        </div>
      )}
      {layer.type === "footer" && (
        <div className="absolute inset-1 flex items-center justify-center text-[9px] text-white/70 text-center pointer-events-none truncate px-1">
          {layer.template}
        </div>
      )}
      {layer.type === "watermark" && (
        <div className="absolute inset-1 flex items-center justify-center text-[10px] text-white/60 pointer-events-none">
          {layer.text}
        </div>
      )}
      {layer.type === "image" && (
        <div className="absolute inset-1 flex items-center justify-center text-[9px] text-white/70 pointer-events-none text-center px-1">
          {layer.imagePath ? "🖼 obraz" : "brak pliku"}
        </div>
      )}
      {layer.type === "shape" && (
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            background: layer.fill,
            border: `${layer.strokeWidth}px solid ${layer.stroke}`,
            borderRadius: layer.shapeKind === "ellipse" ? "9999px" : "2px",
            opacity: layer.opacity,
          }}
        />
      )}
      {selected &&
        HANDLES.map((h) => (
          <span
            key={h}
            className="absolute w-2 h-2 bg-accent border border-panel rounded-sm z-30"
            style={{
              cursor: `${h}-resize`,
              top: h.includes("n") ? -4 : h.includes("s") ? "calc(100% - 4px)" : "calc(50% - 4px)",
              left: h.includes("w") ? -4 : h.includes("e") ? "calc(100% - 4px)" : "calc(50% - 4px)",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(h, e);
            }}
          />
        ))}
    </div>
  );
}
