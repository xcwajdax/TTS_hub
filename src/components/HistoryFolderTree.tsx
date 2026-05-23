import { useMemo } from "react";
import type { ArchiveFolder, FolderFilterId, Generation } from "../types";
import HistoryToolbarButton from "./history/HistoryToolbarButton";

interface Props {
  folders: ArchiveFolder[];
  archive: Generation[];
  selected: FolderFilterId;
  onSelect: (id: FolderFilterId) => void;
  onCreateFolder: () => void;
  onImportFolder: () => void;
}

export default function HistoryFolderTree({
  folders,
  archive,
  selected,
  onSelect,
  onCreateFolder,
  onImportFolder,
}: Props) {
  const counts = useMemo(() => {
    const byFolder = new Map<string | null, number>();
    for (const g of archive) {
      const key = g.folder_id ?? null;
      byFolder.set(key, (byFolder.get(key) ?? 0) + 1);
    }
    return {
      all: archive.length,
      none: byFolder.get(null) ?? 0,
      byId: Object.fromEntries(
        folders.map((f) => [f.id, byFolder.get(f.id) ?? 0] as const),
      ) as Record<string, number>,
    };
  }, [archive, folders]);

  const itemClass = (id: FolderFilterId) =>
    `w-full text-left text-[11px] px-2 py-1 rounded truncate ${
      selected === id
        ? "bg-accent/25 text-heading border border-accent/50"
        : "text-muted hover:text-heading hover:bg-panel2"
    }`;

  return (
    <div className="border-b border-border px-2 py-2 flex flex-col gap-1 min-h-0 max-h-[140px] overflow-y-auto shrink-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Foldery</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <HistoryToolbarButton title="Nowy folder" fallback="+" onClick={onCreateFolder} />
          <HistoryToolbarButton
            title="Wskaż folder archiwum na dysku"
            icon="folder"
            onClick={onImportFolder}
          />
        </div>
      </div>
      <button type="button" className={itemClass("__all__")} onClick={() => onSelect("__all__")}>
        Wszystko w archiwum ({counts.all})
      </button>
      <button type="button" className={itemClass("__none__")} onClick={() => onSelect("__none__")}>
        Bez folderu ({counts.none})
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          type="button"
          className={itemClass(f.id)}
          onClick={() => onSelect(f.id)}
          title={f.slug}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
            style={{ background: f.color ?? "#6366f1" }}
          />
          {f.name} ({counts.byId[f.id] ?? 0})
        </button>
      ))}
    </div>
  );
}
