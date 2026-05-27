import { useMemo } from "react";
import type { ArchiveFolder, ArchiveTag, Generation, GenerationSource } from "../types";
import { groupGenerationsByDate } from "../lib/historyDateGroups";
import { groupGenerationsBySession } from "../lib/historySessionGroups";
import HistoryItem from "./HistoryItem";

interface Props {
  items: Generation[];
  folders: ArchiveFolder[];
  archiveTags?: ArchiveTag[];
  compactView?: boolean;
  groupBySession?: boolean;
  currentSessionId?: string;
  currentId: string | null;
  emptyMessage: string;
  sourceAvatars?: Partial<Record<GenerationSource, string>>;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
}

function DateGroupSections({
  groups,
  folders,
  archiveTags,
  compactView,
  currentId,
  sourceAvatars,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
}: {
  groups: ReturnType<typeof groupGenerationsByDate>;
  folders: ArchiveFolder[];
  archiveTags: ArchiveTag[];
  compactView: boolean;
  currentId: string | null;
  sourceAvatars?: Partial<Record<GenerationSource, string>>;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <section
          key={group.bucket}
          className={`flex flex-col min-w-0 ${compactView ? "history-list__section gap-0.5" : "gap-2"}`}
        >
          <h3 className="history-list__heading">{group.label}</h3>
          <ul className={`flex flex-col min-w-0 list-none m-0 p-0 ${compactView ? "gap-0.5" : "gap-2"}`}>
            {group.items.map((gen) => (
              <li key={gen.id} className="min-w-0">
                <HistoryItem
                  gen={gen}
                  folders={folders}
                  archiveTags={archiveTags}
                  sourceAvatarPath={sourceAvatars?.[gen.source]}
                  compact={compactView}
                  isCurrent={gen.id === currentId}
                  onPlay={onPlay}
                  onChanged={onChanged}
                  onError={onError}
                  onAssignSoundboard={onAssignSoundboard}
                />
              </li>
            ))}
          </ul>
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
  currentSessionId = "",
  currentId,
  emptyMessage,
  sourceAvatars,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
}: Props) {
  const dateGroups = useMemo(() => groupGenerationsByDate(items), [items]);
  const sessionGroups = useMemo(
    () =>
      groupBySession && currentSessionId
        ? groupGenerationsBySession(items, currentSessionId)
        : null,
    [items, groupBySession, currentSessionId],
  );

  if (items.length === 0) {
    return (
      <div className="history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        <p className="text-xs text-muted text-center mt-8 px-3">{emptyMessage}</p>
      </div>
    );
  }

  const listClass = `history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 flex flex-col ${
    compactView ? "history-list--compact gap-2" : "gap-4"
  }`;

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
              sourceAvatars={sourceAvatars}
              onPlay={onPlay}
              onChanged={onChanged}
              onError={onError}
              onAssignSoundboard={onAssignSoundboard}
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
        sourceAvatars={sourceAvatars}
        onPlay={onPlay}
        onChanged={onChanged}
        onError={onError}
        onAssignSoundboard={onAssignSoundboard}
      />
    </div>
  );
}
