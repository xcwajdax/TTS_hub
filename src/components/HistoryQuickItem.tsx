import { useEffect, useState, type MouseEvent } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, AudioFormat, Generation } from "../types";
import {
  archiveGeneration,
  copyGenerationAudioToClipboard,
} from "../api/tauri";
import { displayTitle } from "../lib/generationTitle";
import { formatDurationMs, formatGenerationMs } from "../lib/formatTime";
import { historyQuickItemSurfaceStyle, resolveHistoryItemColor } from "../lib/historySourceUi";
import {
  AUDIO_CLIPBOARD_SUCCESS_TOAST,
  subscribeMp4ExportProgress,
  type Mp4ExportProgress,
} from "../lib/mp4ExportProgress";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import { usePlayback } from "../context/PlaybackContext";
import { usePrivateShareConfirm } from "../lib/usePrivateShareConfirm";
import { useAppView } from "../context/AppViewContext";
import { openMp4Studio } from "../mp4/openMp4Studio";
import Icon from "./Icon";
import HistoryGenerationContextMenu from "./history/HistoryGenerationContextMenu";
import HistoryItemProfileAvatar from "./history/HistoryItemProfileAvatar";
import PrivateBadge from "./history/PrivateBadge";

interface Props {
  gen: Generation;
  folders: ArchiveFolder[];
  isCurrent: boolean;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onToast?: (message: string) => void;
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
  onToast,
  voiceProfiles = [],
}: Props) {
  const { playing } = usePlayback();
  const { requestShare, dialog } = usePrivateShareConfirm();
  const appView = useAppView();
  const [saving, setSaving] = useState(false);
  const [copyingAudio, setCopyingAudio] = useState(false);
  const [mp4Progress, setMp4Progress] = useState<Mp4ExportProgress | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void subscribeMp4ExportProgress(gen.id, setMp4Progress).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [gen.id]);

  const accentColor = resolveHistoryItemColor(gen);
  const resolvedVoiceProfile = resolveProfileForGeneration(gen, voiceProfiles);
  const profileDisplayName =
    resolvedVoiceProfile?.name ?? gen.voice?.trim() ?? "Profil usunięty";
  const titleLabel = displayTitle(gen);
  const durationLabel = formatDurationMs(gen.duration_ms);
  const generationLabel = formatGenerationMs(gen.generation_ms);
  const showDuration = gen.status === "done" && (gen.duration_ms ?? 0) > 0;
  const showGenerationTime = gen.status === "done" && Boolean(generationLabel);
  const canPlay = gen.status === "done" && Boolean(gen.file_path?.trim());
  const canCopy = Boolean(gen.file_path?.trim());
  const copying = copyingAudio;
  const playHandler = onPlay ?? onSelect;
  const isPlaying = isCurrent && playing;
  const mp4Busy =
    mp4Progress != null &&
    mp4Progress.phase !== "done" &&
    mp4Progress.phase !== "error";

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

  const handleOpenMp4Studio = () => {
    requestShare(gen, "MP4", () => {
      if (appView.openMp4Studio) {
        appView.openMp4Studio(gen.id);
      } else {
        openMp4Studio(gen.id);
      }
    });
  };

  const handleCopyAudio = async () => {
    setCopyingAudio(true);
    try {
      await copyGenerationAudioToClipboard(gen.id, gen.format ?? "mp3");
      onToast?.(AUDIO_CLIPBOARD_SUCCESS_TOAST);
    } catch (e) {
      onError(String(e));
    } finally {
      setCopyingAudio(false);
    }
  };

  const showMp4Bar = mp4Busy;
  const mp4Pct = Math.round((mp4Progress?.percent ?? (mp4Busy ? 0.04 : 0)) * 100);

  const handleClick = () => {
    if (saving) return;
    onSelect(gen);
  };

  const handleContextMenu = (e: MouseEvent) => {
    if (gen.status !== "done" || !gen.file_path?.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
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
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      title={gen.text.trim() || titleLabel}
      aria-label={
        showDuration
          ? `Załaduj: ${titleLabel}, ${durationLabel}${
              generationLabel ? `, wygenerowano w ${generationLabel}` : ""
            }`
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
        <span className="truncate text-[11px] font-semibold text-heading flex items-center gap-1 min-w-0">
          <span className="truncate">{profileDisplayName}</span>
          {gen.is_private && <PrivateBadge />}
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted">{titleLabel}</span>
      </div>

      <div className="history-quick-item__rail shrink-0 flex items-stretch self-stretch">
        <div className="history-quick-item__hover-actions">
          <button
            type="button"
            className={[
              "history-quick-item__action-btn",
              isPlaying ? "history-quick-item__action-btn--playing" : "",
            ].join(" ")}
            title={isPlaying ? "Odtwarzanie" : "Odtwórz"}
            aria-label={isPlaying ? "Odtwarzanie" : "Odtwórz"}
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
            title="Otwórz w Studio MP4"
            aria-label="Otwórz w Studio MP4"
            disabled={saving || !canCopy}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenMp4Studio();
            }}
          >
            <Icon name="film" size={ACTION_ICON} />
          </button>
          <button
            type="button"
            className="history-quick-item__action-btn"
            title="Kopiuj audio do schowka"
            aria-label="Kopiuj audio do schowka"
            disabled={saving || copying || !canCopy}
            onClick={(e) => {
              e.stopPropagation();
              requestShare(gen, "audio", () => void handleCopyAudio());
            }}
          >
            <Icon name="music-note" size={ACTION_ICON} />
          </button>
        </div>

        {(showDuration || showGenerationTime) && (
          <div className="history-quick-item__duration flex flex-col items-end justify-start pt-1.5 px-1 min-w-[2.5rem] gap-0">
            {showDuration && (
              <span
                className="text-[11px] font-semibold text-heading tabular-nums whitespace-nowrap"
                title="Długość nagrania"
              >
                {durationLabel}
              </span>
            )}
            {showGenerationTime && (
              <span
                className="text-[9px] text-muted tabular-nums whitespace-nowrap"
                title="Czas generacji"
              >
                {generationLabel}
              </span>
            )}
          </div>
        )}

        <StatusColumn
          gen={gen}
          folderLabel={folderLabel}
          saving={saving}
          onArchive={() => void handleArchive(gen.format)}
        />
      </div>

      {showMp4Bar && (
        <div
          className="absolute inset-x-0 bottom-0 h-[3px] bg-panel2/90 pointer-events-none"
          title={mp4Progress?.message ?? "Renderuję MP4…"}
          role="progressbar"
          aria-valuenow={mp4Pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(mp4Pct, mp4Busy ? 4 : 0)}%` }}
          />
        </div>
      )}
      {dialog}
      {contextMenu && (
        <HistoryGenerationContextMenu
          anchorX={contextMenu.x}
          anchorY={contextMenu.y}
          gen={gen}
          voiceProfiles={voiceProfiles}
          onChanged={onChanged}
          onError={onError}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
