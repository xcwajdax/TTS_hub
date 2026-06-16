import { useMemo } from "react";
import type { VideoLayer, VideoTemplate } from "../../types/videoTemplate";
import { useLayerDragResize } from "../../hooks/useLayerDragResize";
import VideoLayerBox from "./VideoLayerBox";

interface Props {
  template: VideoTemplate;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (layerId: string, patch: Partial<VideoLayer>) => void;
  zoom: number;
}

export default function VideoTemplateCanvas({
  template,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  zoom,
}: Props) {
  const { width, height, background } = template.canvas;
  const scale = zoom;

  const onRectChange = (layerId: string, rect: VideoLayer["rect"]) => {
    onUpdateLayer(layerId, { rect } as Partial<VideoLayer>);
  };

  const drag = useLayerDragResize({
    canvasScale: scale,
    canvasWidth: width,
    canvasHeight: height,
    onRectChange,
  });

  const sortedLayers = useMemo(
    () => [...template.layers].reverse(),
    [template.layers],
  );

  return (
    <div className="video-template-canvas flex flex-col items-center gap-2 min-w-0">
      <div
        className="relative overflow-hidden rounded-lg border border-border shadow-inner"
        style={{
          width: width * scale,
          height: height * scale,
          background,
        }}
        onPointerDown={() => onSelectLayer(null)}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerLeave={drag.onPointerUp}
      >
        {sortedLayers.map((layer) => (
          <VideoLayerBox
            key={layer.id}
            layer={layer}
            scale={scale}
            selected={selectedLayerId === layer.id}
            onSelect={() => {
              onSelectLayer(layer.id);
              drag.setActiveLayerId(layer.id);
            }}
            onMoveStart={(e) => drag.onPointerDownMove(layer.id, layer.rect, e)}
            onResizeStart={(handle, e) =>
              drag.onPointerDownResize(layer.id, layer.rect, handle, e)
            }
          />
        ))}
      </div>
      <p className="text-[10px] text-muted">
        {width}×{height} px · zoom {Math.round(zoom * 100)}%
      </p>
    </div>
  );
}
