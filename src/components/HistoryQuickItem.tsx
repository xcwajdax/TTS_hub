import { useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, AudioFormat, Generation } from "../types";
import { archiveGeneration } from "../api/tauri";
import { displayTitle } from "../lib/generationTitle";
import { formatDurationMs } from "../lib/formatTime";
import { historyItemSurfaceStyle, resolveHistoryItemColor } from "../lib/historySourceUi";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import Icon from "./Icon";
import HistoryItemProfileAvatar from "./history/HistoryItemProfileAvatar";

interface Props {
  gen: Generation;
  folders: ArchiveFolder[];
  isCurrent: boolean;
  onSelect: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

const AVATAR_SIZE = 32;

function FileStatusBadge({
  gen,
  folderLabel,
}: {
  gen: Generation;
  folderLabel: string | null;
}) {
  if (gen.is_archived) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-indigo-500/20 text-indigo-200 border border-indigo-500/30"
        title={folderLabel ? `Archiwum · ${folderLabel}` : "Zapisane w archiwum"}
      >
        <Icon name="status-archived" size={10} />
        Archiwum
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-200 border border-amber-500/25"
      title="Tymczasowy plik sesji"
    >
      <Icon name="status-temp" size={10} />
      Temp
    </span>
  );
}

export default function HistoryQuickItem({
  gen,
  folders,
  isCurrent,
  onSelect,
  onChanged,
  onError,
  voiceProfiles = [],
}: Props) {
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const accentColor = resolveHistoryItemColor(gen);
  const resolvedVoiceProfile = resolveProfileForGeneration(gen, voiceProfiles);
  const profileDisplayName =
    resolvedVoiceProfile?.name ?? gen.voice?.trim() ?? "Profil usunięty";
  const titleLabel = displayTitle(gen);

  const date = new Date(gen.created_at);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const durationLabel = formatDurationMs(gen.duration_ms);

  const folderLabel = gen.folder_id
    ? (folders.find((f) => f.id === gen.folder_id)?.name ?? "Folder")
    : null;

  const handleArchive = async (format: AudioFormat) => {
    setSaving(true);
    try {
      await archiveGeneration(gen.id, format);
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClick = () => {
    if (saving) return;
    onSelect(gen);
  };

  return (
    <div
      tabIndex={0}
      className={[
        "history-quick-item history-item history-item--compact relative min-w-0 overflow-hidden border rounded-md text-xs group",
        "flex flex-row items-stretch gap-2 py-1.5 px-2 transition-shadow duration-200",
        isCurrent ? "history-item--current border-accent bg-panel2" : "border-border hover:brightness-110",
        saving ? "opacity-50 pointer-events-none" : "cursor-pointer",
      ].join(" ")}
      style={historyItemSurfaceStyle(accentColor, isCurrent)}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      title={gen.text.trim() || titleLabel}
      aria-label={`Załaduj: ${titleLabel}, ${timeStr}`}
    >
      <HistoryItemProfileAvatar
        gen={gen}
        profile={resolvedVoiceProfile}
        size={AVATAR_SIZE}
        className="self-center"
      />
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate text-[11px] font-semibold text-heading">
            {profileDisplayName}
          </span>
          <FileStatusBadge gen={gen} folderLabel={folderLabel} />
        </div>
        <span className="min-w-0 truncate text-[10px] text-muted">{titleLabel}</span>
      </div>
      <div className="shrink-0 flex flex-col items-end justify-center gap-0.5">
        <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">{timeStr}</span>
        {gen.status === "done" && (gen.duration_ms ?? 0) > 0 && (
          <span className="text-[9px] text-muted/80 tabular-nums">{durationLabel}</span>
        )}
        {!gen.is_archived && hovered && (
          <button
            type="button"
            className="text-[9px] text-accent hover:text-accent2 mt-0.5"
            title="Archiwizuj"
            onClick={(e) => {
              e.stopPropagation();
              void handleArchive(gen.format);
            }}
          >
            Archiwizuj
          </button>
        )}
      </div>
    </div>
  );
}
