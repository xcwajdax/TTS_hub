import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";

const ACTION_ICON = 16;

interface Props {
  disabled?: boolean;
  onAssign: (slotIndex: number) => void;
}

export default function SoundboardAssignMenu({ disabled, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="history-action-btn"
        title="Przypisz do soundboarda"
        aria-label="Przypisz do soundboarda"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="play" size={ACTION_ICON} />
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 mb-1 z-40 min-w-[100px] py-1 rounded border border-border bg-panel shadow-lg grid grid-cols-4 gap-0.5 px-1"
          role="menu"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="text-[10px] py-1 rounded hover:bg-panel2 text-muted hover:text-heading tabular-nums"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onAssign(i);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
