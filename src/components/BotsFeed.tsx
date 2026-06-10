import { useMemo } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, ArchiveTag, Generation } from "../types";
import { groupGenerationsByOrigin } from "../lib/historyOriginGroups";
import { getOriginAvatar } from "../api/tauri";
import { useEffect, useState } from "react";
import AvatarImage from "./avatars/AvatarImage";
import HistoryItem from "./HistoryItem";

interface Props {
  items: Generation[];
  folders: ArchiveFolder[];
  archiveTags?: ArchiveTag[];
  compactView?: boolean;
  currentId: string | null;
  voiceProfiles?: TtsVoiceProfile[];
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

function OriginGroupHeader({
  originKind,
  label,
}: {
  originKind: string;
  label: string;
}) {
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOriginAvatar(originKind)
      .then((info) => {
        if (!cancelled) setAvatarPath(info.path);
      })
      .catch(() => {
        if (!cancelled) setAvatarPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [originKind]);

  return (
    <div className="flex items-center gap-2 min-w-0 px-1">
      <AvatarImage filePath={avatarPath} fallbackLabel={originKind} size={24} />
      <h3 className="history-list__heading m-0 truncate">{label}</h3>
    </div>
  );
}

export default function BotsFeed({
  items,
  folders,
  archiveTags = [],
  compactView = false,
  currentId,
  voiceProfiles = [],
  onSelect,
  onPlay,
  onChanged,
  onError,
}: Props) {
  const groups = useMemo(() => groupGenerationsByOrigin(items), [items]);

  if (items.length === 0) {
    return (
      <div className="history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
        <p className="text-xs text-muted text-center mt-8 px-3">
          Brak generacji od botów zewnętrznych. Boty wysyłają żądania HTTP z polem origin.
        </p>
      </div>
    );
  }

  const listClass = `history-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 flex flex-col ${
    compactView ? "history-list--compact gap-2" : "gap-4"
  }`;

  return (
    <div className={listClass}>
      {groups.map((group) => (
        <section key={group.key} className={`flex flex-col min-w-0 ${compactView ? "gap-1" : "gap-2"}`}>
          <OriginGroupHeader originKind={group.originKind} label={group.label} />
          <ul className={`flex flex-col min-w-0 list-none m-0 p-0 ${compactView ? "gap-0.5" : "gap-2"}`}>
            {group.items.map((gen) => (
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
                  voiceProfiles={voiceProfiles}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
