import { useState } from "react";
import type { Generation, GenerationSource } from "../types";
import HistoryItem from "./HistoryItem";
import CursorFeed from "./CursorFeed";
import { openArchiveFolder, pickArchiveFolderSettings } from "../api/tauri";

type TabScope = "session" | "archive" | "cursor";

interface Props {
  session: Generation[];
  archive: Generation[];
  currentId: string | null;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

type SourceFilter = "all" | GenerationSource;

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "manual", label: "Ręczne" },
  { id: "cursor", label: "Cursor" },
  { id: "http", label: "HTTP" },
];

export default function HistorySidebar({ session, archive, currentId, onPlay, onChanged, onError }: Props) {
  const [scope, setScope] = useState<TabScope>("session");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const cursorCount = [...session, ...archive].filter((g) => g.source === "cursor").length;
  const baseItems = scope === "session" ? session : scope === "archive" ? archive : [];
  const items = sourceFilter === "all" ? baseItems : baseItems.filter((g) => g.source === sourceFilter);

  const handlePickFolder = async () => {
    try {
      await pickArchiveFolderSettings();
      onChanged();
    } catch (e) { onError(String(e)); }
  };

  const handleOpenArchive = async () => {
    try { await openArchiveFolder(); } catch (e) { onError(String(e)); }
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel">
      <div className="flex border-b border-border">
        <button
          className={`flex-1 py-2.5 text-sm ${scope === "session" ? "bg-panel2 text-white border-b-2 border-accent" : "text-muted hover:text-white"}`}
          onClick={() => setScope("session")}
        >
          Sesja ({session.length})
        </button>
        <button
          className={`flex-1 py-2.5 text-sm ${scope === "archive" ? "bg-panel2 text-white border-b-2 border-accent" : "text-muted hover:text-white"}`}
          onClick={() => setScope("archive")}
        >
          Archiwum ({archive.length})
        </button>
        <button
          className={`flex-1 py-2.5 text-sm ${scope === "cursor" ? "bg-panel2 text-white border-b-2 border-accent" : "text-muted hover:text-white"}`}
          onClick={() => setScope("cursor")}
          title="Wszystko z Cursor (sesja + archiwum)"
        >
          Cursor ({cursorCount})
        </button>
      </div>

      {scope === "cursor" && (
        <CursorFeed session={session} archive={archive} currentId={currentId} onPlay={onPlay} />
      )}

      {scope === "archive" && (
        <div className="flex gap-1 p-2 border-b border-border">
          <button className="btn flex-1 text-xs" onClick={handleOpenArchive}>Otworz folder</button>
          <button className="btn flex-1 text-xs" onClick={handlePickFolder}>Wskaz folder</button>
        </div>
      )}

      {scope !== "cursor" && (
      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              sourceFilter === f.id
                ? "bg-accent/30 border-accent text-white"
                : "bg-panel2 border-border text-muted hover:text-white"
            }`}
            onClick={() => setSourceFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      )}

      {scope !== "cursor" && (
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted text-center mt-8 px-3">
            {scope === "session"
              ? "Brak generacji w tej sesji. Wygeneruj cos po lewej."
              : "Archiwum jest puste. Zapisz generacje przyciskiem dyskietki."}
          </div>
        ) : (
          items.map((g) => (
            <HistoryItem
              key={g.id}
              gen={g}
              isCurrent={g.id === currentId}
              onPlay={onPlay}
              onChanged={onChanged}
              onError={onError}
            />
          ))
        )}
      </div>
      )}
    </div>
  );
}
