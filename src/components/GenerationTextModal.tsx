import { useEffect } from "react";
import { formatModelLabel } from "../ttsModels";
import type { Generation } from "../types";
import { displayTitle } from "../lib/generationTitle";
import { usePlayback } from "../context/PlaybackContext";
import HistoryTextPreview from "./HistoryTextPreview";
import Icon from "./Icon";

interface Props {
  open: boolean;
  gen: Generation;
  onClose: () => void;
}

export default function GenerationTextModal({ open, gen, onClose }: Props) {
  const { playing } = usePlayback();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyText = () => {
    void navigator.clipboard.writeText(gen.text).catch(() => undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-panel border border-border shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-text-title"
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <h2 id="generation-text-title" className="text-base font-semibold truncate">
              {displayTitle(gen)}
            </h2>
            <p className="text-[11px] text-muted mt-1">
              {formatModelLabel(gen.model)}
              <span className="text-muted/60"> · </span>
              {gen.voice}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 p-1 text-muted hover:text-accent transition-colors"
            onClick={onClose}
            aria-label="Zamknij"
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="generation-text-modal__body p-4 min-h-[160px]">
          <HistoryTextPreview text={gen.text} scroll={playing} />
        </div>

        <footer className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn text-sm" onClick={copyText}>
            Kopiuj tekst
          </button>
          <button type="button" className="btn-primary text-sm" onClick={onClose}>
            Zamknij
          </button>
        </footer>
      </div>
    </div>
  );
}
