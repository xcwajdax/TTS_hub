export type AppView = "tts" | "extensions";

interface Props {
  view: AppView;
  onViewChange: (view: AppView) => void;
}

export default function AppViewTabs({ view, onViewChange }: Props) {
  return (
    <div
      className="flex border-b border-border shrink-0 bg-panel"
      role="tablist"
      aria-label="Widok aplikacji"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "tts"}
        className={`flex-1 py-2 text-sm ${
          view === "tts"
            ? "bg-panel2 text-heading border-b-2 border-accent"
            : "text-muted hover:text-heading"
        }`}
        onClick={() => onViewChange("tts")}
      >
        TTS
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "extensions"}
        className={`flex-1 py-2 text-sm ${
          view === "extensions"
            ? "bg-panel2 text-heading border-b-2 border-accent"
            : "text-muted hover:text-heading"
        }`}
        onClick={() => onViewChange("extensions")}
      >
        Rozszerzenia
      </button>
    </div>
  );
}
