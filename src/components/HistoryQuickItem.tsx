import { useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, AudioFormat, Generation } from "../types";
import { archiveGeneration, copyGenerationAudioToClipboard } from "../api/tauri";
import { displayTitle } from "../lib/generationTitle";
import { formatDurationMs } from "../lib/formatTime";
import { historyQuickItemSurfaceStyle, resolveHistoryItemColor } from "../lib/historySourceUi";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import Icon from "./Icon";
import HistoryItemProfileAvatar from "./history/HistoryItemProfileAvatar";

interface Props {
  gen: Generation;
  folders: ArchiveFolder[];
  isCurrent: boolean;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

const AVATAR_SIZE = 32;
const ACTION_ICON = 14;

function StatusColumn({
  gen,
  folderLabel,
  saving,
  onArchive,
}: {
  gen: Generation;
  folderLabel: string | null;
  saving: boolean;
  onArchive: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (gen.is_archived) {
    return (
      <div
        className="history-quick-item__status history-quick-item__status--archived"
        title={folderLabel ? `Archiwum · ${folderLabel}` : "Zapisane w archiwum"}
      >
        <span className="history-quick-item__status-label">Arch.</span>
      </div>
    );
  }

  const label = hovered ? "Archive" : "Temp";
  const title = hovered ? "Archiwizuj" : "Tymczasowy plik sesji";

  return (
    <button
      type="button"
      className="history-quick-item__status history-quick-item__status--temp"
      title={title}
      aria-label={title}
      disabled={saving}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onArchive();
      }}
    >
      <span className="history-quick-item__status-label">{label}</span>
    </button>
  );
}

export default function HistoryQuickItem({
  gen,
  folders,
  isCurrent,
  onSelect,
  onPlay,
  onChanged,
  onError,
  voiceProfiles = [],
}: Props) {
  const [saving, setSaving] = useState(false);

  const accentColor = resolveHistoryItemColor(gen);
  const resolvedVoiceProfile = resolveProfileForGeneration(gen, voiceProfiles);
  const profileDisplayName =
    resolvedVoiceProfile?.name ?? gen.voice?.trim() ?? "Profil usunięty";
  const titleLabel = displayTitle(gen);
  const durationLabel = formatDurationMs(gen.duration_ms);
  const showDuration = gen.status === "done" && (gen.duration_ms ?? 0) > 0;
  const canPlay = gen.status === "done" && Boolean(gen.file_path?.trim());
  const canCopy = Boolean(gen.file_path?.trim());
  const playHandler = onPlay ?? onSelect;

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

  const handleCopy = async () => {
    try {
      await copyGenerationAudioToClipboard(gen.id);
    } catch (e) {
      onError(String(e));
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
        "history-quick-item history-item history-item--compact relative min-w-0 overflow-hidden border-0 border-y border-border/60 text-xs group",
        "flex flex-row items-stretch gap-2 py-1.5 pl-2 pr-0 transition-shadow duration-200 rounded-none",
        isCurrent ? "history-item--current border-accent bg-panel2" : "border-border hover:brightness-110",
        saving ? "opacity-50 pointer-events-none" : "cursor-pointer",
      ].join(" ")}
      style={historyQuickItemSurfaceStyle(accentColor, isCurrent)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      title={gen.text.trim() || titleLabel}
      aria-label={
        showDuration
          ? `Załaduj: ${titleLabel}, ${durationLabel}`
          : `Załaduj: ${titleLabel}`
      }
    >
      <HistoryItemProfileAvatar
        gen={gen}
        profile={resolvedVoiceProfile}
        size={AVATAR_SIZE}
        className="self-center shrink-0"
      />

      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 py-0.5">
        <span className="truncate text-[11px] font-semibold text-heading">{profileDisplayName}</span>
        <span className="min-w-0 truncate text-[10px] text-muted">{titleLabel}</span>
      </div>

      <div className="history-quick-item__rail shrink-0 flex items-stretch self-stretch">
        <div className="history-quick-item__hover-actions">
          <button
            type="button"
            className="history-quick-item__action-btn"
            title="Odtwórz"
            aria-label="Odtwórz"
            disabled={saving || !canPlay}
            onClick={(e) => {
              e.stopPropagation();
              playHandler(gen);
            }}
          >
            <Icon name="play" size={ACTION_ICON} />
          </button>
          <button
            type="button"
            className="history-quick-item__action-btn"
            title="Kopiuj audio do schowka"
            aria-label="Kopiuj audio do schowka"
            disabled={saving || !canCopy}
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
          >
            <Icon name="copy" size={ACTION_ICON} />
          </button>
        </div>

        {showDuration && (
          <div
            className="history-quick-item__duration flex items-start justify-end pt-2 px-1 min-w-[2.25rem]"
            title="Długość nagrania"
          >
            <span className="text-[11px] font-semibold text-heading tabular-nums whitespace-nowrap">
              {durationLabel}
            </span>
          </div>
        )}

        <StatusColumn
          gen={gen}
          folderLabel={folderLabel}
          saving={saving}
          onArchive={() => void handleArchive(gen.format)}
        />
      </div>
    </div>
  );
}
