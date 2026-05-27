import { useEffect, useMemo, useState } from "react";
import SoundboardPanel from "../plugins/soundboard/SoundboardPanel";
import { getSoundboard } from "../api/tauri";
import { useSoundboardPlugin } from "../plugins/useSoundboardPlugin";
import { PLUGINS_CHANGED } from "../plugins/events";
import { isTauriApp } from "../lib/tauriEnv";
import {
  loadHistoryCompactView,
  loadHistoryScopeTab,
  saveHistoryCompactView,
  saveHistoryScopeTab,
  HISTORY_PREFS_CHANGED,
} from "../lib/historyPlaybackPrefs";
import { setSoundboardSlot } from "../api/tauri";
import { SOUNDBOARD_SLOTS_CHANGED } from "../plugins/soundboard/SoundboardPanel";
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
import HistorySoundboardDock from "./history/HistorySoundboardDock";
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
  initialScope?: HistoryScopeTab;
  onInitialScopeConsumed?: () => void;
  onSoundboardToast?: (message: string) => void;
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
  initialScope,
  onInitialScopeConsumed,
  onSoundboardToast,
}: Props) {
  const [scope, setScope] = useState<HistoryScopeTab>(
    () => loadHistoryScopeTab() ?? "session",
  );

  const changeScope = (next: HistoryScopeTab) => {
    setScope(next);
    saveHistoryScopeTab(next);
  };
  const { installed: soundboardInstalled, enabled: soundboardEnabled } =
    useSoundboardPlugin();
  const [soundboardFilledCount, setSoundboardFilledCount] = useState(0);
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

  useEffect(() => {
    if (!initialScope) return;
    setScope(initialScope);
    saveHistoryScopeTab(initialScope);
    onInitialScopeConsumed?.();
  }, [initialScope, onInitialScopeConsumed]);

  const assignToSoundboard = async (generationId: string, slotIndex: number) => {
    try {
      const next = await setSoundboardSlot(slotIndex, { generationId });
      setSoundboardFilledCount(next.slots.filter((s) => s.hasAudio).length);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
      onSoundboardToast?.(`Przypisano do slotu ${slotIndex + 1}`);
    } catch (e) {
      onError(String(e));
    }
  };

  useEffect(() => {
    if (!isTauriApp() || !soundboardInstalled) return;
    void getSoundboard()
      .then((sb) => setSoundboardFilledCount(sb.slots.filter((s) => s.hasAudio).length))
      .catch(() => {});
  }, [soundboardInstalled]);

  useEffect(() => {
    if (!soundboardInstalled && scope === "soundboard") {
      setScope("session");
      saveHistoryScopeTab("session");
    }
  }, [soundboardInstalled, scope]);

  useEffect(() => {
    const onPlugins = () => {
      if (!soundboardInstalled) return;
      void getSoundboard()
        .then((sb) => setSoundboardFilledCount(sb.slots.filter((s) => s.hasAudio).length))
        .catch(() => {});
    };
    window.addEventListener(PLUGINS_CHANGED, onPlugins);
    return () => window.removeEventListener(PLUGINS_CHANGED, onPlugins);
  }, [soundboardInstalled]);

  const historyCandidates = useMemo(() => {
    const done = [...session, ...archive].filter((g) => g.status === "done" && g.file_path);
    return done.slice(0, 80);
  }, [session, archive]);

  const scopeCounts = useMemo(
    (): Record<HistoryScopeTab, number> => ({
      session: session.length,
      cursor: cursorFeed.length,
      archive: archive.length,
      soundboard: soundboardFilledCount,
    }),
    [session.length, cursorFeed.length, archive.length, soundboardFilledCount],
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

  const showSoundboardTab = scope === "soundboard";
  const showHistoryMain = !showSoundboardTab;

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel">
      <ActiveJobsPanel interrupted={interrupted} onChanged={onChanged} onError={onError} />

      <HistoryScopeTabs
        scope={scope}
        counts={scopeCounts}
        onScopeChange={changeScope}
        soundboardInstalled={soundboardInstalled}
      />

      <div className="flex flex-col flex-1 min-h-0">
        {showSoundboardTab && soundboardInstalled && (
          <SoundboardPanel
            variant="embedded"
            onError={onError}
            onToast={onSoundboardToast}
            historyCandidates={historyCandidates}
            onFilledCountChange={setSoundboardFilledCount}
            pluginEnabled={soundboardEnabled}
          />
        )}
        {showSoundboardTab && !soundboardInstalled && (
          <p className="p-4 text-sm text-muted text-center">
            Zainstaluj Soundboard w zakładce Rozszerzenia.
          </p>
        )}

        {showHistoryMain && (
          <>
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

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                  onAssignSoundboard={
                    soundboardInstalled && soundboardEnabled
                      ? (id, slot) => void assignToSoundboard(id, slot)
                      : undefined
                  }
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

            {soundboardInstalled && (
              <HistorySoundboardDock
                filledCount={soundboardFilledCount}
                historyCandidates={historyCandidates}
                onError={onError}
                onToast={onSoundboardToast}
                onFilledCountChange={setSoundboardFilledCount}
                onOpenFullTab={() => changeScope("soundboard")}
                pluginEnabled={soundboardEnabled}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
