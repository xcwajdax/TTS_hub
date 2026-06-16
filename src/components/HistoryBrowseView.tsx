import { useEffect, useMemo, useState } from "react";
import SoundboardPanel from "../plugins/soundboard/SoundboardPanel";
import { getAppSettings, getSoundboard } from "../api/tauri";
import { useSoundboardPlugin } from "../plugins/useSoundboardPlugin";
import { PLUGINS_CHANGED } from "../plugins/events";
import { isTauriApp } from "../lib/tauriEnv";
import {
  loadHistoryCompactView,
  loadHistoryGroupingMode,
  loadHistoryProfileFilter,
  loadHistoryScopeTab,
  saveHistoryCompactView,
  saveHistoryGroupingMode,
  saveHistoryProfileFilter,
  saveHistoryScopeTab,
  HISTORY_PREFS_CHANGED,
} from "../lib/historyPlaybackPrefs";
import { setSoundboardSlot } from "../api/tauri";
import { SOUNDBOARD_SLOTS_CHANGED } from "../plugins/soundboard/SoundboardPanel";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, ArchiveTag, FolderFilterId, Generation } from "../types";
import type { HistoryGroupingMode, HistoryScopeTab } from "../lib/historyToolbar";
import {
  countGenerationsByProfile,
  filterGenerationsByProfile,
  type ProfileFilterId,
} from "../lib/historyProfileGroups";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import HistoryGroupedList from "./HistoryGroupedList";
import CursorFeed from "./CursorFeed";
import BotsFeed from "./BotsFeed";
import HistoryScopeRail from "./history/HistoryScopeRail";
import HistoryDetailPanel from "./history/HistoryDetailPanel";
import HistoryCompactToolbar from "./history/HistoryCompactToolbar";
import ProfileAvatarFilterBar from "./history/ProfileAvatarFilterBar";
import HistoryBulkActionsBar from "./history/HistoryBulkActionsBar";
import VideoLibraryPanel from "./video/VideoLibraryPanel";
import { listVideoExports } from "../lib/videoTemplates";
import { useAppView } from "../context/AppViewContext";
import { usePlayback } from "../context/PlaybackContext";
import { createFolder, createTag, pickArchiveFolderSettings } from "../api/tauri";
import type { SourceFilter } from "./history/HistorySourceFilterBar";

interface Props {
  session: Generation[];
  archive: Generation[];
  cursorFeed: Generation[];
  botsFeed: Generation[];
  folders: ArchiveFolder[];
  tags: ArchiveTag[];
  currentSessionId: string;
  currentId: string | null;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onOpenOrganizationSettings?: () => void;
  initialScope?: HistoryScopeTab;
  onInitialScopeConsumed?: () => void;
  onSoundboardToast?: (message: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

export default function HistoryBrowseView({
  session,
  archive,
  cursorFeed,
  botsFeed,
  folders,
  tags,
  currentSessionId,
  currentId,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onOpenOrganizationSettings,
  initialScope,
  onInitialScopeConsumed,
  onSoundboardToast,
  voiceProfiles: voiceProfilesProp,
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
  const [videoExportCount, setVideoExportCount] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [profileFilter, setProfileFilter] = useState<ProfileFilterId>(
    () => loadHistoryProfileFilter(),
  );
  const [groupingMode, setGroupingMode] = useState<HistoryGroupingMode>(
    () => loadHistoryGroupingMode(),
  );
  const [folderFilter, setFolderFilter] = useState<FolderFilterId>("__all__");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [compactView, setCompactView] = useState(loadHistoryCompactView);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tempHistoryMax, setTempHistoryMax] = useState<number | undefined>();

  const [voiceProfilesState, setVoiceProfilesState] = useState<TtsVoiceProfile[]>(
    () => voiceProfilesProp ?? [],
  );
  const voiceProfiles = voiceProfilesProp ?? voiceProfilesState;

  useEffect(() => {
    if (voiceProfilesProp) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const view = await getAppSettings();
        if (!cancelled) {
          setVoiceProfilesState(view.voice_profiles ?? []);
          setTempHistoryMax(view.temp_history_max);
        }
      } catch {
        // ignore
      }
    };
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_PROFILES_CHANGED, onChange);
    };
  }, [voiceProfilesProp]);

  useEffect(() => {
    if (!isTauriApp()) return;
    void getAppSettings()
      .then((view) => setTempHistoryMax(view.temp_history_max))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => {
      setCompactView(loadHistoryCompactView());
      setGroupingMode(loadHistoryGroupingMode());
      setProfileFilter(loadHistoryProfileFilter());
    };
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
    void listVideoExports(500, 0)
      .then((list) => setVideoExportCount(list.length))
      .catch(() => setVideoExportCount(0));
  }, [scope]);

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
      bots: botsFeed.length,
      archive: archive.length,
      video: videoExportCount,
      soundboard: soundboardFilledCount,
    }),
    [session.length, cursorFeed.length, botsFeed.length, archive.length, videoExportCount, soundboardFilledCount],
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

  const baseItems =
    scope === "session"
      ? session
      : scope === "archive"
        ? archiveFiltered
        : scope === "bots"
          ? botsFeed
          : [];

  const sourceFilteredItems =
    sourceFilter === "all" ? baseItems : baseItems.filter((g) => g.source === sourceFilter);

  const profileCounts = useMemo(
    () => countGenerationsByProfile(sourceFilteredItems, voiceProfiles),
    [sourceFilteredItems, voiceProfiles],
  );

  const unprofiledCount = profileCounts.get("__none__") ?? 0;

  const items = useMemo(
    () => filterGenerationsByProfile(sourceFilteredItems, voiceProfiles, profileFilter),
    [sourceFilteredItems, voiceProfiles, profileFilter],
  );

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const { onBackToTts } = useAppView();
  const { current } = usePlayback();

  const showProfileFilters = scope === "session" || scope === "archive" || scope === "bots";
  const showSourceFilter = scope === "session" || scope === "archive";
  const showSoundboardTab = scope === "soundboard";
  const showVideoTab = scope === "video";
  const showHistoryMain = !showSoundboardTab && !showVideoTab;
  const showDetailPanel = showHistoryMain && Boolean(current);
  const listLayout = compactView ? "list" : "grid";

  const scopeLabel = {
    session: "Sesja",
    cursor: "Cursor",
    bots: "Boty",
    archive: "Archiwum",
    video: "Wideo",
    soundboard: "Soundboard",
  }[scope];

  const displayCount =
    scope === "cursor"
      ? cursorFeed.length
      : scope === "video"
        ? videoExportCount
        : scope === "soundboard"
          ? soundboardFilledCount
          : items.length;

  return (
    <div className="history-browse-view flex flex-col h-full min-w-0 overflow-hidden bg-panel">
      <header className="history-browse-view__header shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-panel2/40">
        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-semibold">Historia</h1>
          <p className="text-[11px] text-muted truncate">
            {scopeLabel} · {displayCount}{" "}
            {scope === "soundboard"
              ? "slotów"
              : scope === "video"
                ? videoExportCount === 1
                  ? "plik"
                  : "plików"
                : displayCount === 1
                  ? "pozycja"
                  : "pozycji"}
          </p>
        </div>
        <button type="button" className="btn text-xs shrink-0" onClick={onBackToTts}>
          ← Wróć do TTS
        </button>
      </header>

      <div
        className={`history-browse-view__body flex-1 min-h-0 grid overflow-hidden ${
          showDetailPanel ? "history-browse-view__body--with-detail" : ""
        }`}
      >
        <HistoryScopeRail
          scope={scope}
          counts={scopeCounts}
          onScopeChange={changeScope}
          soundboardInstalled={soundboardInstalled}
          folders={folders}
          archive={archive}
          folderFilter={folderFilter}
          onFolderFilterChange={setFolderFilter}
          onCreateFolder={() => {
            if (onOpenOrganizationSettings) onOpenOrganizationSettings();
            else void handleQuickCreateFolder();
          }}
          onImportFolder={() => void handlePickFolder()}
          tags={tags}
          selectedTagIds={selectedTagIds}
          onToggleTag={toggleTagFilter}
          onClearTags={() => setSelectedTagIds(new Set())}
          onCreateTag={() => void handleQuickCreateTag()}
          soundboardFilledCount={soundboardFilledCount}
          historyCandidates={historyCandidates}
          onSoundboardError={onError}
          onSoundboardToast={onSoundboardToast}
          onSoundboardFilledCountChange={setSoundboardFilledCount}
          onOpenSoundboardTab={() => changeScope("soundboard")}
          soundboardEnabled={soundboardEnabled}
        />

        <main className="history-browse-view__main flex flex-col min-h-0 min-w-0 overflow-hidden">
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

          {showVideoTab && (
            <VideoLibraryPanel
              onError={onError}
              onToast={onSoundboardToast}
            />
          )}

          {showHistoryMain && (
            <>
              {showProfileFilters && (
                <ProfileAvatarFilterBar
                  profiles={voiceProfiles}
                  counts={profileCounts}
                  value={profileFilter}
                  onChange={(next) => {
                    setProfileFilter(next);
                    saveHistoryProfileFilter(next);
                  }}
                  totalCount={sourceFilteredItems.length}
                  unprofiledCount={unprofiledCount}
                />
              )}

              <HistoryCompactToolbar
                compactView={compactView}
                onCompactViewChange={(next) => {
                  setCompactView(next);
                  saveHistoryCompactView(next);
                }}
                groupingMode={groupingMode}
                onGroupingModeChange={(next) => {
                  setGroupingMode(next);
                  saveHistoryGroupingMode(next);
                }}
                showGrouping={scope === "session" || scope === "archive" || scope === "bots"}
                selectionMode={selectionMode}
                onSelectionModeChange={(enabled) => {
                  setSelectionMode(enabled);
                  if (!enabled) setSelectedIds(new Set());
                }}
                sourceFilter={sourceFilter}
                onSourceFilterChange={setSourceFilter}
                showSourceFilter={showSourceFilter}
              />

              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {scope === "cursor" && (
                  <CursorFeed items={cursorFeed} currentId={currentId} onPlay={onSelect} />
                )}

                {scope === "bots" && (
                  <BotsFeed
                    items={items}
                    folders={folders}
                    archiveTags={tags}
                    compactView={compactView}
                    currentId={currentId}
                    voiceProfiles={voiceProfiles}
                    onSelect={onSelect}
                    onPlay={onPlay}
                    onChanged={onChanged}
                    onError={onError}
                  />
                )}

                {scope !== "cursor" && scope !== "bots" && (
                  <HistoryGroupedList
                    items={items}
                    folders={folders}
                    archiveTags={tags}
                    compactView={compactView}
                    layout={listLayout}
                    groupBySession={scope === "session"}
                    groupingMode={groupingMode}
                    currentSessionId={currentSessionId}
                    currentId={currentId}
                    onSelect={onSelect}
                    onPlay={onPlay}
                    onChanged={onChanged}
                    onError={onError}
                    onAssignSoundboard={
                      soundboardInstalled && soundboardEnabled
                        ? (id, slot) => void assignToSoundboard(id, slot)
                        : undefined
                    }
                    voiceProfiles={voiceProfiles}
                    tempHistoryMax={tempHistoryMax}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    emptyMessage={
                      scope === "session"
                        ? "Brak generacji w historii sesji. Wygeneruj coś w zakładce TTS."
                        : selectedTagIds.size > 0
                          ? "Brak pozycji z wybranymi tagami."
                          : folderFilter === "__all__"
                            ? "Archiwum jest puste. Zapisz generacje z panelu timeline."
                            : "Brak pozycji w tym folderze."
                    }
                  />
                )}
              </div>
            </>
          )}
        </main>

        {showDetailPanel && onPlay && (
          <HistoryDetailPanel
            folders={folders}
            archiveTags={tags}
            voiceProfiles={voiceProfiles}
            onPlay={onPlay}
            onChanged={onChanged}
            onError={onError}
          />
        )}
      </div>

      {selectionMode && showHistoryMain && (
        <HistoryBulkActionsBar
          selectedIds={selectedIds}
          folders={folders}
          onClearSelection={clearSelection}
          onChanged={onChanged}
          onError={onError}
        />
      )}
    </div>
  );
}
