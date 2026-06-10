import { confirm } from "@tauri-apps/plugin-dialog";
import { archiveGeneration, deleteGeneration, moveToFolder } from "../../api/tauri";
import type { ArchiveFolder, AudioFormat } from "../../types";
import Icon from "../Icon";

interface Props {
  selectedIds: Set<string>;
  folders: ArchiveFolder[];
  onClearSelection: () => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

export default function HistoryBulkActionsBar({
  selectedIds,
  folders,
  onClearSelection,
  onChanged,
  onError,
}: Props) {
  if (selectedIds.size === 0) return null;

  const runBulk = async (action: "archive" | "delete" | "folder", folderId?: string | null) => {
    const ids = [...selectedIds];
    if (action === "delete") {
      const ok = await confirm(
        `Usunąć ${ids.length} pozycji z historii? Pliki audio zostaną trwale usunięte.`,
        { title: "Usuń zaznaczone", kind: "warning" },
      );
      if (!ok) return;
    }

    try {
      for (const id of ids) {
        if (action === "archive") {
          await archiveGeneration(id, "wav" as AudioFormat);
        } else if (action === "delete") {
          await deleteGeneration(id);
        } else if (action === "folder") {
          await moveToFolder(id, folderId ?? null);
        }
      }
      onClearSelection();
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-panel2/90 px-2 py-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-muted tabular-nums shrink-0">
        Zaznaczono: {selectedIds.size}
      </span>
      <button
        type="button"
        className="btn text-[10px] !py-0.5 !px-2"
        onClick={() => void runBulk("archive")}
      >
        <Icon name="archive" size={12} className="inline mr-0.5" />
        Archiwizuj
      </button>
      <div className="relative group">
        <button type="button" className="btn text-[10px] !py-0.5 !px-2">
          <Icon name="folder" size={12} className="inline mr-0.5" />
          Folder
        </button>
        <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-50 min-w-[140px] py-1 rounded border border-border bg-panel shadow-lg">
          <button
            type="button"
            className="block w-full text-left px-2 py-1 text-[11px] hover:bg-panel2"
            onClick={() => void runBulk("folder", null)}
          >
            Główne archiwum
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className="block w-full text-left px-2 py-1 text-[11px] hover:bg-panel2"
              onClick={() => void runBulk("folder", f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="btn text-[10px] !py-0.5 !px-2 hover:!bg-red-900/40"
        onClick={() => void runBulk("delete")}
      >
        <Icon name="trash" size={12} className="inline mr-0.5" />
        Usuń
      </button>
      <button
        type="button"
        className="ml-auto text-[10px] text-muted hover:text-heading"
        onClick={onClearSelection}
      >
        Anuluj
      </button>
    </div>
  );
}
