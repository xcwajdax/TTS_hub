import { useEffect, useRef, useState } from "react";
import { useTimelineView } from "../context/TimelineViewContext";
import {
  TIMELINE_VIEW_DESCRIPTIONS,
  TIMELINE_VIEW_LABELS,
  TIMELINE_VIEW_MODES,
  type TimelineViewMode,
} from "../lib/timelineView";

interface Props {
  anchorX: number;
  anchorY: number;
  onClose: () => void;
}

export default function TimelineContextMenu({ anchorX, anchorY, onClose }: Props) {
  const { mode, setMode } = useTimelineView();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchorX, top: anchorY });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = anchorX;
    let top = anchorY;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPosition({ left, top });
  }, [anchorX, anchorY]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const pick = (next: TimelineViewMode) => {
    void setMode(next);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Wygląd timeline"
      className="fixed z-[200] min-w-[220px] py-1 rounded-lg border border-border bg-panel shadow-lg text-sm"
      style={{ left: position.left, top: position.top }}
    >
      <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted border-b border-border/80">
        Wygląd timeline
      </p>
      {TIMELINE_VIEW_MODES.map((id) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${
              selected ? "bg-panel2 text-heading" : "hover:bg-panel2/80 text-foreground"
            }`}
            onClick={() => pick(id)}
          >
            <span className="flex items-center gap-2 font-medium text-xs">
              <span
                className={`w-3 h-3 rounded-full border shrink-0 ${
                  selected ? "border-accent bg-accent/30" : "border-border"
                }`}
                aria-hidden
              />
              {TIMELINE_VIEW_LABELS[id]}
            </span>
            <span className="text-[10px] text-muted pl-5">{TIMELINE_VIEW_DESCRIPTIONS[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
