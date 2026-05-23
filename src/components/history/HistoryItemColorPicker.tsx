import { useEffect, useRef, useState } from "react";
import { updateGenerationUiColor } from "../../api/tauri";
import { HISTORY_COLOR_PRESETS } from "../../lib/historySourceUi";
interface Props {
  genId: string;
  currentColor: string;
  hasManualOverride: boolean;
  disabled?: boolean;
  onChanged: () => void;
  onError: (e: string) => void;
}

export default function HistoryItemColorPicker({
  genId,
  currentColor,
  hasManualOverride,
  disabled,
  onChanged,
  onError,
}: Props) {
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

  const applyColor = async (color: string | null) => {
    setOpen(false);
    try {
      await updateGenerationUiColor(genId, color);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="history-action-btn"
        disabled={disabled}
        title={hasManualOverride ? "Kolor wpisu (ręczny)" : "Kolor wpisu (automatyczny ze źródła)"}
        aria-label="Ustaw kolor wpisu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span
          className="block w-3.5 h-3.5 rounded-sm border border-border/80"
          style={{ backgroundColor: currentColor }}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 z-50 p-2 rounded border border-border bg-panel shadow-lg flex flex-col gap-1.5 min-w-[120px]"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-1">
            {HISTORY_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-6 h-6 rounded border border-border/60 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                title={c}
                aria-label={`Kolor ${c}`}
                onClick={() => void applyColor(c)}
              />
            ))}
          </div>
          {hasManualOverride && (
            <button
              type="button"
              className="text-[10px] text-left text-muted hover:text-ink px-1 py-0.5"
              onClick={() => void applyColor(null)}
            >
              Przywróć kolor źródła
            </button>
          )}
        </div>
      )}
    </div>
  );
}
