import Icon from "../Icon";
import HistoryFolderTree from "../HistoryFolderTree";
import HistoryTagFilterBar from "./HistoryTagFilterBar";
import HistorySoundboardDock from "./HistorySoundboardDock";
import {
  SCOPE_TAB_META,
  type HistoryScopeTab,
} from "../../lib/historyToolbar";
import type { ArchiveFolder, ArchiveTag, FolderFilterId, Generation } from "../../types";

const TAB_ORDER: HistoryScopeTab[] = ["session", "cursor", "bots", "archive", "video", "soundboard"];

interface Props {
  scope: HistoryScopeTab;
  counts: Record<HistoryScopeTab, number>;
  onScopeChange: (scope: HistoryScopeTab) => void;
  soundboardInstalled?: boolean;
  folders: ArchiveFolder[];
  archive: Generation[];
  folderFilter: FolderFilterId;
  onFolderFilterChange: (id: FolderFilterId) => void;
  onCreateFolder: () => void;
  onImportFolder: () => void;
  tags: ArchiveTag[];
  selectedTagIds: Set<string>;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  onCreateTag: () => void;
  soundboardFilledCount: number;
  historyCandidates: Generation[];
  onSoundboardError: (message: string) => void;
  onSoundboardToast?: (message: string) => void;
  onSoundboardFilledCountChange: (count: number) => void;
  onOpenSoundboardTab: () => void;
  soundboardEnabled?: boolean;
}

export default function HistoryScopeRail({
  scope,
  counts,
  onScopeChange,
  soundboardInstalled = false,
  folders,
  archive,
  folderFilter,
  onFolderFilterChange,
  onCreateFolder,
  onImportFolder,
  tags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
  onCreateTag,
  soundboardFilledCount,
  historyCandidates,
  onSoundboardError,
  onSoundboardToast,
  onSoundboardFilledCountChange,
  onOpenSoundboardTab,
  soundboardEnabled = true,
}: Props) {
  const tabs = soundboardInstalled
    ? TAB_ORDER
    : TAB_ORDER.filter((id) => id !== "soundboard");

  return (
    <aside
      className="history-scope-rail shrink-0 flex flex-col min-h-0 border-r border-border bg-panel overflow-hidden"
      aria-label="Zakres historii"
    >
      <nav
        className="shrink-0 flex flex-col gap-0.5 py-2 px-1.5"
        role="tablist"
        aria-label="Zakres historii"
      >
        {tabs.map((id) => {
          const meta = SCOPE_TAB_META[id];
          const active = scope === id;
          const count = counts[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              title={meta.title ?? meta.label}
              onClick={() => onScopeChange(id)}
              className={`history-scope-rail__btn flex items-center gap-2 w-full min-w-0 px-2 py-2 rounded-md text-left transition-colors ${
                active
                  ? "bg-panel2 text-heading"
                  : "text-muted hover:text-heading hover:bg-panel2/50"
              }`}
            >
              <Icon name={meta.icon} size={18} className="shrink-0 opacity-90" />
              <span className="flex-1 min-w-0 text-[11px] font-medium truncate">{meta.label}</span>
              {count > 0 && id !== "soundboard" && (
                <span className="text-[10px] tabular-nums text-muted shrink-0">{count}</span>
              )}
              {id === "soundboard" && count > 0 && (
                <span className="text-[10px] tabular-nums text-accent/80 shrink-0">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {scope === "archive" && (
        <div className="history-scope-rail__archive flex flex-col flex-1 min-h-0 overflow-hidden border-t border-border">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <HistoryFolderTree
              folders={folders}
              archive={archive}
              selected={folderFilter}
              onSelect={onFolderFilterChange}
              onCreateFolder={onCreateFolder}
              onImportFolder={onImportFolder}
            />
          </div>
          <HistoryTagFilterBar
            tags={tags}
            selectedTagIds={selectedTagIds}
            onToggleTag={onToggleTag}
            onClear={onClearTags}
            onCreateTag={onCreateTag}
          />
        </div>
      )}

      {soundboardInstalled && scope !== "soundboard" && (
        <div className="mt-auto shrink-0 min-h-0 max-h-[40%] flex flex-col border-t border-border">
          <HistorySoundboardDock
            filledCount={soundboardFilledCount}
            historyCandidates={historyCandidates}
            onError={onSoundboardError}
            onToast={onSoundboardToast}
            onFilledCountChange={onSoundboardFilledCountChange}
            onOpenFullTab={onOpenSoundboardTab}
            pluginEnabled={soundboardEnabled}
          />
        </div>
      )}
    </aside>
  );
}
