import { useEffect, useMemo, useState } from "react";
import {
  loadHistoryCompactView,
  saveHistoryCompactView,
  HISTORY_PREFS_CHANGED,
} from "../lib/historyPlaybackPrefs";
import type { ArchiveFolder, ArchiveTag, FolderFilterId, Generation } from "../types";
import type { HistoryScopeTab } from "../lib/historyToolbar";
import HistoryGroupedList from "./HistoryGroupedList";
import CursorFeed from "./CursorFeed";
import ActiveJobsPanel from "./ActiveJobsPanel";
import HistoryFolderTree from "./HistoryFolderTree";
import HistoryScopeTabs from "./history/HistoryScopeTabs";
import HistoryViewModeToggle from "./history/HistoryViewModeToggle";
import HistorySourceFilterBar, { type SourceFilter } from "./history/HistorySourceFilterBar";
import HistoryTagFilterBar from "./history/HistoryTagFilterBar";
import { createFolder, createTag, pickArchiveFolderSettings } from "../api/tauri";
import { useSourceAvatars } from "../hooks/useAvatars";

interface Props {
  session: Generation[];
  archive: Generation[];
  cursorFeed: Generation[];
  folders: ArchiveFolder[];
  tags: ArchiveTag[];
  interrupted: Generation[];
  currentSessionId: string;
  currentId: string | null;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onOpenOrganizationSettings?: () => void;
}

export default function HistorySidebar({
  session,
  archive,
  cursorFeed,
  folders,
  tags,
  interrupted,
  currentSessionId,
  currentId,
  onPlay,
  onChanged,
  onError,
  onOpenOrganizationSettings,
}: Props) {
  const [scope, setScope] = useState<HistoryScopeTab>("session");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [folderFilter, setFolderFilter] = useState<FolderFilterId>("__all__");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [compactView, setCompactView] = useState(loadHistoryCompactView);
  const sourceAvatars = useSourceAvatars();

  useEffect(() => {
    const sync = () => setCompactView(loadHistoryCompactView());
    window.addEventListener(HISTORY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(HISTORY_PREFS_CHANGED, sync);
  }, []);

  const scopeCounts = useMemo(
    (): Record<HistoryScopeTab, number> => ({
      session: session.length,
      cursor: cursorFeed.length,
      archive: archive.length,
    }),
    [session.length, cursorFeed.length, archive.length],
  );

  const archiveFiltered = useMemo(() => {
    let list = archive;
    if (folderFilter === "__none__") list = list.filter((g) => !g.folder_id);
    else if (folderFilter !== "__all__") list = list.filter((g) => g.folder_id === folderFilter);

    if (selectedTagIds.size > 0) {
      list = list.filter((g) => {
        const ids = g.tag_ids ?? [];
        return ids.some((id) => selectedTagIds.has(id));
      });
    }
    return list;
  }, [archive, folderFilter, selectedTagIds]);

  const baseItems = scope === "session" ? session : scope === "archive" ? archiveFiltered : [];
  const items =
    sourceFilter === "all" ? baseItems : baseItems.filter((g) => g.source === sourceFilter);

  const handlePickFolder = async () => {
    try {
      await pickArchiveFolderSettings();
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleQuickCreateFolder = async () => {
    const name = window.prompt("Nazwa folderu archiwum:");
    if (!name?.trim()) return;
    try {
      await createFolder(name.trim());
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleQuickCreateTag = async () => {
    const name = window.prompt("Nazwa tagu:");
    if (!name?.trim()) return;
    try {
      await createTag(name.trim());
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel">
      <ActiveJobsPanel interrupted={interrupted} onChanged={onChanged} onError={onError} />

      <HistoryScopeTabs scope={scope} counts={scopeCounts} onScopeChange={setScope} />

      <HistoryViewModeToggle
        compactView={compactView}
        onChange={(next) => {
          setCompactView(next);
          saveHistoryCompactView(next);
        }}
      />

      {scope === "archive" && (
        <HistoryFolderTree
          folders={folders}
          archive={archive}
          selected={folderFilter}
          onSelect={setFolderFilter}
          onCreateFolder={() => {
            if (onOpenOrganizationSettings) onOpenOrganizationSettings();
            else void handleQuickCreateFolder();
          }}
          onImportFolder={() => void handlePickFolder()}
        />
      )}

      {(scope === "session" || scope === "archive") && (
        <HistorySourceFilterBar value={sourceFilter} onChange={setSourceFilter} />
      )}

      {scope === "archive" && (
        <HistoryTagFilterBar
          tags={tags}
          selectedTagIds={selectedTagIds}
          onToggleTag={toggleTagFilter}
          onClear={() => setSelectedTagIds(new Set())}
          onCreateTag={() => void handleQuickCreateTag()}
        />
      )}

      {scope === "cursor" && (
        <CursorFeed items={cursorFeed} currentId={currentId} onPlay={onPlay} />
      )}

      {scope !== "cursor" && (
        <HistoryGroupedList
          items={items}
          folders={folders}
          archiveTags={tags}
          sourceAvatars={sourceAvatars}
          compactView={compactView}
          groupBySession={scope === "session"}
          currentSessionId={currentSessionId}
          currentId={currentId}
          onPlay={onPlay}
          onChanged={onChanged}
          onError={onError}
          emptyMessage={
            scope === "session"
              ? "Brak generacji w historii sesji. Wygeneruj cos po lewej."
              : selectedTagIds.size > 0
                ? "Brak pozycji z wybranymi tagami."
                : folderFilter === "__all__"
                  ? "Archiwum jest puste. Zapisz generacje przyciskiem dyskietki."
                  : "Brak pozycji w tym folderze."
          }
        />
      )}
    </div>
  );
}
