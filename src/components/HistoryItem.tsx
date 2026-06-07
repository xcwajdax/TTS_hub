import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { formatModelLabel } from "../ttsModels";
import type { ArchiveFolder, ArchiveTag, AudioFormat, Generation } from "../types";
import { useRelativeTime } from "../hooks/useRelativeTime";
import {
  archiveGeneration,
  copyGenerationAudioToClipboard,
  deleteGeneration,
  moveToFolder,
  revealInExplorer,
  updateGenerationTitle,
} from "../api/tauri";
import { usePlayback } from "../context/PlaybackContext";
import { loadPlainTextIntoEditor } from "../lib/editorTextLoad";
import { deriveTitleFromText, displayTitle } from "../lib/generationTitle";
import {
  HISTORY_PREFS_CHANGED,
  loadHistoryClickToPlay,
} from "../lib/historyPlaybackPrefs";
import { formatDurationMs } from "../lib/formatTime";
import {
  getSourceUi,
  hexToRgba,
  resolveHistoryItemColor,
  sourceLabelForGeneration,
} from "../lib/historySourceUi";
import AvatarImage from "./avatars/AvatarImage";
import Icon from "./Icon";
import HistoryTextPreview from "./HistoryTextPreview";
import SaveSplitButton from "./SaveSplitButton";
import HistoryItemColorPicker from "./history/HistoryItemColorPicker";
import HistoryItemInlinePlayback from "./history/HistoryItemInlinePlayback";
import HistoryTokenInfoButton from "./history/HistoryTokenInfoButton";
import HistoryItemTagPicker from "./history/HistoryItemTagPicker";
import SoundboardAssignMenu from "./history/SoundboardAssignMenu";

interface Props {
  gen: Generation;
  folders: ArchiveFolder[];
  archiveTags?: ArchiveTag[];
  sourceAvatarPath?: string | null;
  compact?: boolean;
  isCurrent: boolean;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
}

const ACTION_ICON = 16;
const PLAY_ICON = 18;
const META_ICON = 14;

const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, .history-action-group, .history-format-picker, [role='button'], [role='menuitem'], [contenteditable='true']";

export default function HistoryItem({
  gen,
  folders,
  archiveTags = [],
  sourceAvatarPath,
  compact = false,
  isCurrent,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
}: Props) {
  const { playing } = usePlayback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [clickToPlay, setClickToPlay] = useState(loadHistoryClickToPlay);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const relative = useRelativeTime(gen.created_at);

  const isPlaying = isCurrent && playing;
  const accentColor = resolveHistoryItemColor(gen);
  const sourceUi = getSourceUi(gen.source);
  const barBg = hexToRgba(accentColor, 0.42);
  const cardAccentStyle = {
    borderLeftWidth: 3,
    borderLeftColor: accentColor,
  } as const;

  useEffect(() => {
    const sync = () => setClickToPlay(loadHistoryClickToPlay());
    window.addEventListener(HISTORY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(HISTORY_PREFS_CHANGED, sync);
  }, []);

  const date = new Date(gen.created_at);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const durationLabel = formatDurationMs(gen.duration_ms);

  const titleLabel = displayTitle(gen);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    if (saving) return;
    setDraft(titleLabel);
    setEditing(true);
  };

  const commitEdit = async () => {
    if (!editing || saving) return;
    setEditing(false);

    const trimmed = draft.trim() || deriveTitleFromText(gen.text);
    const titleChanged = trimmed !== titleLabel;

    if (!titleChanged) return;

    setSaving(true);
    try {
      await updateGenerationTitle(gen.id, trimmed);
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(titleLabel);
  };

  const handleArchive = async (format: AudioFormat) => {
    try {
      await archiveGeneration(gen.id, format);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleDelete = async () => {
    const ok = await confirm(
      `Czy na pewno usunąć „${titleLabel}" z historii? Plik audio zostanie trwale usunięty.`,
      { title: "Usuń z historii", kind: "warning" },
    );
    if (!ok) return;

    try {
      await deleteGeneration(gen.id);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    setFolderMenuOpen(false);
    try {
      await moveToFolder(gen.id, folderId);
      onChanged();
    } catch (e) {
      onError(String(e));
    }
  };

  const folderLabel = gen.folder_id
    ? (folders.find((f) => f.id === gen.folder_id)?.name ?? "Folder")
    : null;

  const userTags = (gen.tag_ids ?? [])
    .map((id) => archiveTags.find((t) => t.id === id))
    .filter((t): t is ArchiveTag => Boolean(t));

  const handleRevealFile = async () => {
    if (!gen.file_path?.trim()) {
      onError("Brak pliku audio dla tej generacji");
      return;
    }
    try {
      await revealInExplorer(gen.file_path);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleCopyAudio = async () => {
    try {
      await copyGenerationAudioToClipboard(gen.id);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleCompactClick = () => {
    if (saving) return;
    onPlay(gen);
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (saving || !clickToPlay) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    onPlay(gen);
  };

  const cardStateClass = isCurrent
    ? isPlaying
      ? "history-item--playing border-accent"
      : "history-item--current border-accent"
    : "border-border";

  if (compact) {
    const createdLabel = `${dateStr} · ${timeStr}`;
    return (
      <div
        tabIndex={0}
        className={[
          "history-item history-item--compact relative min-w-0 overflow-hidden border rounded-md text-xs",
          "flex flex-row items-center justify-between gap-2 py-1.5 px-2 transition-shadow duration-200",
          cardStateClass,
          isCurrent ? "bg-panel2" : "bg-panel/60 hover:bg-panel2/80",
          saving ? "opacity-50 pointer-events-none" : "cursor-pointer",
        ].join(" ")}
        style={cardAccentStyle}
        onClick={handleCompactClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCompactClick();
          }
        }}
        title={gen.text.trim() || titleLabel}
        aria-label={`Odtwórz: ${titleLabel}, ${createdLabel}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <AvatarImage
            filePath={sourceAvatarPath}
            fallbackIcon={sourceUi.icon}
            size={12}
            className="opacity-90"
            title={sourceUi.label}
          />
          <span
            className={[
              "min-w-0 truncate text-[11px] font-medium",
              isPlaying ? "text-accent2" : "text-heading",
            ].join(" ")}
          >
            {titleLabel}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-muted tabular-nums whitespace-nowrap">
          {createdLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={[
        "history-item relative min-w-0 overflow-hidden border rounded-md text-xs flex flex-col",
        cardStateClass,
        isCurrent ? "bg-panel2 history-item--expanded" : "bg-panel/60",
        clickToPlay && !saving && !isCurrent ? "cursor-pointer" : "",
        saving ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
      style={cardAccentStyle}
      onClick={handleCardClick}
    >
      <div
        className="history-item-meta-bar flex items-center gap-1.5 px-2 py-1 min-h-[1.75rem] shrink-0"
        style={{
          backgroundColor: barBg,
          boxShadow: `inset 0 -1px 0 ${hexToRgba(accentColor, 0.55)}`,
        }}
      >
        <AvatarImage
          filePath={sourceAvatarPath}
          fallbackIcon={sourceUi.icon}
          size={META_ICON}
          className="shrink-0"
          title={sourceUi.label}
        />
        <Icon
          name={gen.is_archived ? "status-archived" : "status-temp"}
          size={META_ICON}
          className="shrink-0 opacity-90"
          title={gen.is_archived ? "Zapisany w archiwum" : "Plik tymczasowy (sesja)"}
        />
        <HistoryTokenInfoButton gen={gen} />
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted tabular-nums shrink-0">
          <span className="whitespace-nowrap">
            {dateStr} · {timeStr}
          </span>
          <span className="whitespace-nowrap" title="Długość nagrania">
            {durationLabel}
          </span>
          <span className="hidden sm:inline whitespace-nowrap">{relative}</span>
        </span>
      </div>

      <div className="history-item-body flex flex-col flex-1 min-h-0 gap-1.5 p-2.5 pt-2">
        <div className="min-w-0 w-full overflow-hidden">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="block w-full min-w-0 max-w-full box-border text-[13px] font-medium bg-panel border border-accent rounded px-1.5 py-0.5 outline-none"
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commitEdit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] font-medium leading-snug hover:text-accent2 disabled:opacity-50"
              onClick={startEdit}
              disabled={saving}
              title={titleLabel}
            >
              {titleLabel}
            </button>
          )}
        </div>

        <HistoryTextPreview text={gen.text} scroll={false} />

        {isCurrent && <HistoryItemInlinePlayback playing={isPlaying} />}

        <div className="history-item-provenance text-[10px] text-muted flex flex-wrap gap-x-2 gap-y-0.5 min-w-0">
          <span title={gen.model}>
            <span className="text-muted/70">Model:</span> {formatModelLabel(gen.model)}
          </span>
          <span>
            <span className="text-muted/70">Źródło:</span> {sourceLabelForGeneration(gen)}
          </span>
          {gen.origin_kind && (
            <span
              title={
                [gen.origin_user_name, gen.origin_user_id, gen.origin_platform_id]
                  .filter(Boolean)
                  .join(" · ") || gen.origin_kind
              }
            >
              <span className="text-muted/70">Origin:</span>{" "}
              {gen.origin_user_name
                ? `${gen.origin_kind}: ${gen.origin_user_name}`
                : gen.origin_kind}
            </span>
          )}
          <span className="min-w-0 truncate" title={gen.voice}>
            <span className="text-muted/70">Głos:</span> {gen.voice}
          </span>
        </div>

        <div className="history-item__tags flex flex-wrap gap-1 min-w-0">
          <span className="tag">{gen.format.toUpperCase()}</span>
          {gen.is_archived && <span className="tag text-accent2">ARCHIVE</span>}
          {folderLabel && <span className="tag text-indigo-300">{folderLabel}</span>}
          {userTags.map((t) => (
            <span
              key={t.id}
              className="history-user-tag"
              style={t.color ? { borderColor: t.color, color: t.color } : undefined}
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="history-item__actions flex shrink-0 flex-wrap items-center gap-1 px-2.5 pb-2 pt-0">
        <button
          type="button"
          className="history-action-btn"
          onClick={() => onPlay(gen)}
          title="Odtwórz"
          aria-label="Odtwórz"
        >
          <Icon name="play" size={PLAY_ICON} />
        </button>

        <button
          type="button"
          className="history-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            loadPlainTextIntoEditor(gen.text);
          }}
          title="Importuj tekst do edytora nowej generacji"
          aria-label="Importuj tekst do edytora"
          disabled={saving || !gen.text.trim()}
        >
          <Icon name="clip-insert" size={ACTION_ICON} />
        </button>

        <button
          type="button"
          className="history-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            void handleCopyAudio();
          }}
          title="Kopiuj plik audio do schowka"
          aria-label="Kopiuj plik audio"
          disabled={saving || !gen.file_path?.trim()}
        >
          <Icon name="copy" size={ACTION_ICON} />
        </button>

        <button
          type="button"
          className="history-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            void handleRevealFile();
          }}
          title="Pokaż plik w Eksploratorze"
          aria-label="Pokaż plik"
          disabled={saving || !gen.file_path?.trim()}
        >
          <Icon name="folder-filled" size={ACTION_ICON} />
        </button>

        {!gen.is_archived && (
          <SaveSplitButton
            onSave={handleArchive}
            disabled={saving}
            saveIcon="archive"
            groupLabel="Archiwizuj"
            saveTitle="Archiwizuj"
          />
        )}

        {gen.is_archived && (
          <div onClick={(e) => e.stopPropagation()}>
            <HistoryItemTagPicker
              gen={gen}
              tags={archiveTags}
              disabled={saving}
              onChanged={onChanged}
              onError={onError}
            />
          </div>
        )}

        <HistoryItemColorPicker
          genId={gen.id}
          currentColor={accentColor}
          hasManualOverride={Boolean(gen.ui_color?.trim())}
          disabled={saving}
          onChanged={onChanged}
          onError={onError}
        />

        {onAssignSoundboard && gen.status === "done" && gen.file_path && (
          <div onClick={(e) => e.stopPropagation()}>
            <SoundboardAssignMenu
              disabled={saving}
              onAssign={(slot) => onAssignSoundboard(gen.id, slot)}
            />
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            className="history-action-btn"
            title="Przenieś do folderu"
            aria-label="Przenieś do folderu"
            onClick={(e) => {
              e.stopPropagation();
              setFolderMenuOpen((v) => !v);
            }}
            disabled={saving}
          >
            <Icon name="folder" size={ACTION_ICON} />
          </button>
          {folderMenuOpen && (
            <div
              className="absolute bottom-full right-0 mb-1 z-40 min-w-[140px] py-1 rounded border border-border bg-panel shadow-lg"
              role="menu"
            >
              <button
                type="button"
                className="block w-full text-left px-2 py-1 text-[11px] hover:bg-panel2"
                onClick={() => void handleMoveToFolder(null)}
              >
                Bez folderu (główne archiwum)
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="block w-full text-left px-2 py-1 text-[11px] hover:bg-panel2"
                  onClick={() => void handleMoveToFolder(f.id)}
                >
                  {f.name}
                </button>
              ))}
              {folders.length === 0 && (
                <span className="block px-2 py-1 text-[10px] text-muted">Brak folderów</span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="history-action-btn history-action-btn--danger ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            void handleDelete();
          }}
          title="Usuń"
          aria-label="Usuń"
          disabled={saving}
        >
          <Icon name="trash" size={ACTION_ICON} />
        </button>
      </div>
    </div>
  );
}
