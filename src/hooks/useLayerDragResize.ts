import { useCallback, useRef, useState } from "react";
import type { VideoRect } from "../types/videoTemplate";
import { normalizeVideoRect } from "../lib/videoTemplateRect";

const SNAP = 8;

function snap(n: number): number {
  return Math.round(n / SNAP) * SNAP;
}

interface DragState {
  layerId: string;
  mode: "move" | "resize";
  handle?: string;
  startX: number;
  startY: number;
  startRect: VideoRect;
}

interface Options {
  canvasScale: number;
  canvasWidth: number;
  canvasHeight: number;
  onRectChange: (layerId: string, rect: VideoRect) => void;
}

export function useLayerDragResize({
  canvasScale,
  canvasWidth,
  canvasHeight,
  onRectChange,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const clampRect = useCallback(
    (rect: VideoRect): VideoRect => {
      return normalizeVideoRect(
        {
          x: snap(rect.x),
          y: snap(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        canvasWidth,
        canvasHeight,
      );
    },
    [canvasWidth, canvasHeight],
  );

  const onPointerDownMove = useCallback(
    (layerId: string, rect: VideoRect, e: React.PointerEvent) => {
      e.stopPropagation();
      setActiveLayerId(layerId);
      dragRef.current = {
        layerId,
        mode: "move",
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerDownResize = useCallback(
    (layerId: string, rect: VideoRect, handle: string, e: React.PointerEvent) => {
      e.stopPropagation();
      setActiveLayerId(layerId);
      dragRef.current = {
        layerId,
        mode: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / canvasScale;
      const dy = (e.clientY - drag.startY) / canvasScale;
      const start = drag.startRect;

      if (drag.mode === "move") {
        onRectChange(
          drag.layerId,
          clampRect({
            ...start,
            x: start.x + dx,
            y: start.y + dy,
          }),
        );
        return;
      }

      const handle = drag.handle ?? "se";
      let { x, y, width, height } = start;

      if (handle.includes("e")) width = start.width + dx;
      if (handle.includes("s")) height = start.height + dy;
      if (handle.includes("w")) {
        width = start.width - dx;
        x = start.x + dx;
      }
      if (handle.includes("n")) {
        height = start.height - dy;
        y = start.y + dy;
      }

      onRectChange(drag.layerId, clampRect({ x, y, width, height }));
    },
    [canvasScale, clampRect, onRectChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return {
    activeLayerId,
    setActiveLayerId,
    onPointerDownMove,
    onPointerDownResize,
    onPointerMove,
    onPointerUp,
  };
}
