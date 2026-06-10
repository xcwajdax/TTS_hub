import { useMemo } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, ArchiveTag, Generation, GenerationSource, TtsProvider } from "../types";
import { groupGenerationsByDate } from "../lib/historyDateGroups";
import { groupGenerationsBySession } from "../lib/historySessionGroups";
import {
  groupGenerationsByProfile,
} from "../lib/historyProfileGroups";
import type { HistoryGroupingMode } from "../lib/historyToolbar";
import { profileVoiceId } from "../lib/voiceProfiles";
import { useVoiceAvatar } from "../hooks/useAvatars";
import HistoryItem from "./HistoryItem";
import AvatarImage from "./avatars/AvatarImage";

interface Props {
  items: Generation[];
  folders: ArchiveFolder[];
  archiveTags?: ArchiveTag[];
  compactView?: boolean;
  groupBySession?: boolean;
  groupingMode?: HistoryGroupingMode;
  currentSessionId?: string;
  currentId: string | null;
  emptyMessage: string;
  sourceAvatars?: Partial<Record<GenerationSource, string>>;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
  voiceProfiles?: TtsVoiceProfile[];
  tempHistoryMax?: number;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  layout?: "list" | "grid";
}

function ProfileGroupHeader({
  profile,
  label,
  count,
}: {
  profile: TtsVoiceProfile | null;
  label: string;
  count: number;
}) {
  const avatar = useVoiceAvatar(
    (profile?.provider ?? "google") as TtsProvider,
    profile ? profileVoiceId(profile) : "",
  );
  return (
    <div className="flex items-center gap-2 min-w-0 px-1">
      <AvatarImage
        filePath={profile ? avatar?.path ?? null : null}
        fallbackLabel={label}
        size={32}
      />
      <h3 className="history-list__heading m-0 truncate flex-1">{label}</h3>
      <span className="text-[10px] text-muted tabular-nums shrink-0">{count}</span>
    </div>
  );
}

function ItemList({
  gens,
  folders,
  archiveTags,
  compactView,
  currentId,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
  voiceProfiles,
  tempHistoryMax,
  selectionMode,
  selectedIds,
  onToggleSelect,
  layout = "list",
}: {
  gens: Generation[];
  folders: ArchiveFolder[];
  archiveTags: ArchiveTag[];
  compactView: boolean;
  layout?: "list" | "grid";
  currentId: string | null;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
  voiceProfiles: TtsVoiceProfile[];
  tempHistoryMax?: number;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const listLayoutClass =
    layout === "grid" ? "history-list__grid" : `flex flex-col ${compactView ? "gap-0.5" : "gap-2"}`;

  return (
    <ul className={`min-w-0 list-none m-0 p-0 ${listLayoutClass}`}>
      {gens.map((gen) => (
        <li key={gen.id} className="min-w-0">
          <HistoryItem
            gen={gen}
            folders={folders}
            archiveTags={archiveTags}
            compact={compactView}
            isCurrent={gen.id === currentId}
            onSelect={onSelect}
            onPlay={onPlay}
            onChanged={onChanged}
            onError={onError}
            onAssignSoundboard={onAssignSoundboard}
            voiceProfiles={voiceProfiles}
            tempHistoryMax={tempHistoryMax}
            selectionMode={selectionMode}
            selected={selectedIds?.has(gen.id)}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(gen.id) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

function DateGroupSections({
  groups,
  folders,
  archiveTags,
  compactView,
  currentId,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
  voiceProfiles,
  tempHistoryMax,
  selectionMode,
  selectedIds,
  onToggleSelect,
  layout = "list",
}: {
  groups: ReturnType<typeof groupGenerationsByDate>;
  layout?: "list" | "grid";
  folders: ArchiveFolder[];
  archiveTags: ArchiveTag[];
  compactView: boolean;
  currentId: string | null;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
  voiceProfiles: TtsVoiceProfile[];
  tempHistoryMax?: number;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <section
          key={group.bucket}
          className={`flex flex-col min-w-0 ${compactView ? "history-list__section gap-0.5" : "gap-2"}`}
        >
          <h3 className="history-list__heading">{group.label}</h3>
          <ItemList
            gens={group.items}
            folders={folders}
            archiveTags={archiveTags}
            compactView={compactView}
            currentId={currentId}
            onSelect={onSelect}
            onPlay={onPlay}
            onChanged={onChanged}
            onError={onError}
            onAssignSoundboard={onAssignSoundboard}
            voiceProfiles={voiceProfiles}
            tempHistoryMax={tempHistoryMax}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            layout={layout}
          />
        </section>
      ))}
    </>
  );
}

export default function HistoryGroupedList({
  items,
  folders,
  archiveTags = [],
  compactView = false,
  groupBySession = false,
  groupingMode = "date",
  currentSessionId = "",
  currentId,
  emptyMessage,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
  voiceProfiles = [],
  tempHistoryMax,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  layout = "list",
}: Props) {
  const dateGroups = useMemo(() => groupGenerationsByDate(items), [items]);
  const sessionGroups = useMemo(
    () =>
      groupBySession && currentSessionId && groupingMode === "date"
        ? groupGenerationsBySession(items, currentSessionId)
        : null,
    [items, groupBySession, currentSessionId, groupingMode],
  );
  const profileGroups = useMemo(
    () => (groupingMode === "profile" ? groupGenerationsByProfile(items, voiceProfiles) : null),
    [items, groupingMode, voiceProfiles],
  );

  if (items.length === 0) {
    return (
      <div className="history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        <p className="text-xs text-muted text-center mt-8 px-3">{emptyMessage}</p>
      </div>
    );
  }

  const listClass = [
    "history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 flex flex-col",
    compactView ? "history-list--compact gap-2" : "gap-4",
    layout === "grid" ? "history-list--grid" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (profileGroups) {
    return (
      <div className={listClass}>
        {profileGroups.map((group) => (
          <section
            key={group.profileId}
            className={`flex flex-col min-w-0 ${compactView ? "gap-1" : "gap-2"}`}
          >
            <ProfileGroupHeader
              profile={group.profile}
              label={group.label}
              count={group.items.length}
            />
            <DateGroupSections
              groups={groupGenerationsByDate(group.items)}
              folders={folders}
              archiveTags={archiveTags}
              compactView={compactView}
              currentId={currentId}
              onSelect={onSelect}
              onPlay={onPlay}
              onChanged={onChanged}
              onError={onError}
              onAssignSoundboard={onAssignSoundboard}
              voiceProfiles={voiceProfiles}
              tempHistoryMax={tempHistoryMax}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              layout={layout}
            />
          </section>
        ))}
      </div>
    );
  }

  if (sessionGroups) {
    return (
      <div className={listClass}>
        {sessionGroups.map((session) => (
          <div
            key={session.sessionId}
            className={`flex flex-col min-w-0 ${compactView ? "gap-2" : "gap-3"}`}
          >
            <h2
              className={`history-list__heading m-0 ${
                session.isCurrent ? "text-accent" : ""
              }`}
            >
              {session.label}
            </h2>
            <DateGroupSections
              groups={session.dateGroups}
              folders={folders}
              archiveTags={archiveTags}
              compactView={compactView}
              currentId={currentId}
              onSelect={onSelect}
              onPlay={onPlay}
              onChanged={onChanged}
              onError={onError}
              onAssignSoundboard={onAssignSoundboard}
              voiceProfiles={voiceProfiles}
              tempHistoryMax={tempHistoryMax}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              layout={layout}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={listClass}>
      <DateGroupSections
        groups={dateGroups}
        folders={folders}
        archiveTags={archiveTags}
        compactView={compactView}
        currentId={currentId}
        onSelect={onSelect}
        onPlay={onPlay}
        onChanged={onChanged}
        onError={onError}
        onAssignSoundboard={onAssignSoundboard}
        voiceProfiles={voiceProfiles}
        tempHistoryMax={tempHistoryMax}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        layout={layout}
      />
    </div>
  );
}
