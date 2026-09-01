import type { CustomTextLayer, KaraokeLayer, VideoLayer, VideoLayerType, VideoLoopLayer } from "../../types/videoTemplate";
import { LAYER_LABELS } from "../../types/videoTemplate";
import { convertFileSrc } from "@tauri-apps/api/core";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

const LAYER_COLORS: Record<VideoLayerType, string> = {
  cover: "rgba(96,165,250,0.35)",
  karaoke: "rgba(250,204,21,0.35)",
  footer: "rgba(167,139,250,0.35)",
  watermark: "rgba(148,163,184,0.35)",
  image: "rgba(52,211,153,0.35)",
  shape: "rgba(244,114,182,0.35)",
  customText: "rgba(94,234,212,0.35)",
  videoLoop: "rgba(251,146,60,0.35)",
};

interface Props {
  layer: VideoLayer;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (handle: string, e: React.PointerEvent) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  let s = hex.trim().replace(/^#/, "");
  if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const r = parseInt(s.slice(0, 2), 16) || 0;
  const g = parseInt(s.slice(2, 4), 16) || 0;
  const b = parseInt(s.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function CustomTextLayerPreview({ layer }: { layer: CustomTextLayer }) {
  const alignItems =
    layer.verticalAlign === "top"
      ? "flex-start"
      : layer.verticalAlign === "bottom"
        ? "flex-end"
        : "center";
  const textAlign = layer.align;
  return (
    <div
      className="absolute inset-1 flex pointer-events-none overflow-hidden rounded-sm"
      style={{ alignItems, justifyContent: "center" }}
    >
      <div
        className="w-full max-w-full px-2 py-1 rounded-sm text-center"
        style={{
          background: layer.background
            ? hexToRgba(layer.backgroundColor, layer.backgroundOpacity)
            : "transparent",
          color: layer.color,
          textAlign,
          fontWeight: layer.bold ? 700 : 500,
          fontStyle: layer.italic ? "italic" : "normal",
          fontSize: `${Math.max(9, layer.fontSize * 0.35)}px`,
          lineHeight: 1.15,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {layer.text || "(pusty)"}
      </div>
    </div>
  );
}

function VideoLoopLayerPreview({ layer }: { layer: VideoLoopLayer }) {
  const hasSource = !!layer.videoPath && layer.videoPath.trim().length > 0;
  return (
    <div className="absolute inset-1 flex items-center justify-center pointer-events-none overflow-hidden rounded-sm bg-black/30">
      {hasSource ? (
        // <video> element with autoPlay loop muted so the canvas
        // preview keeps animating in real time. We use convertFileSrc
        // so the file is reachable through Tauri's asset protocol.
        <video
          src={convertFileSrc(layer.videoPath!)}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
          style={{ opacity: layer.opacity }}
        />
      ) : (
        <div className="text-[9px] text-white/70 text-center px-1">
          🎞 brak pliku MP4
        </div>
      )}
      <span className="absolute top-0 right-0 text-[9px] px-1 py-0.5 bg-black/50 text-white/80 rounded-bl pointer-events-none">
        {layer.rotationSpeed === 0 ? "statyczny" : `${layer.rotationSpeed.toFixed(2)} obr/s`}
      </span>
    </div>
  );
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
      <span className="absolute top-0 left-0 text-[9px] px-1 py-0.5 bg-black/50 text-white rounded-br pointer-events-none z-10">
        {LAYER_LABELS[layer.type]}
      </span>
      {layer.type === "karaoke" && <KaraokeLayerPreview layer={layer} />}
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
      {layer.type === "customText" && <CustomTextLayerPreview layer={layer} />}
      {layer.type === "videoLoop" && <VideoLoopLayerPreview layer={layer} />}
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

const PREVIEW_LINES = [
  "Wiersz pierwszy przykładowy",
  "One runs off for smoke",
  "finds a ditch instead",
  "Kolejna linia piosenki",
  "Ostatni wers widoczny",
];

function KaraokeLayerPreview({ layer }: { layer: KaraokeLayer }) {
  const mode = layer.scrollMode ?? "classic";

  if (mode === "line-focus") {
    return (
      <div className="absolute inset-1 flex flex-col items-center justify-center gap-[3px] pointer-events-none text-center overflow-hidden px-1">
        {PREVIEW_LINES.map((line, i) => {
          const dist = Math.abs(i - 2);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.42 : 0.18;
          const fontSize = dist === 0 ? "0.72em" : "0.58em";
          return (
            <span
              key={line}
              className="text-white leading-tight"
              style={{ opacity, fontSize, fontWeight: dist === 0 ? 700 : 500 }}
            >
              {line}
            </span>
          );
        })}
      </div>
    );
  }

  if (mode === "smooth") {
    return (
      <div
        className="absolute inset-1 overflow-hidden pointer-events-none text-white/85 text-justify leading-[1.15] px-1"
        style={{ fontSize: "0.55em" }}
      >
        {PREVIEW_LINES.join(" ")} {PREVIEW_LINES.join(" ")}
      </div>
    );
  }

  return (
    <div className="absolute inset-2 flex items-end justify-center text-[10px] text-white/80 text-center pointer-events-none">
      Przykładowa linia karaoke…
    </div>
  );
}
