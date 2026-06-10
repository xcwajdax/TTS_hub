import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { formatModelLabel } from "../ttsModels";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, ArchiveTag, Generation } from "../types";
import { useRelativeTime } from "../hooks/useRelativeTime";
import {
  copyGenerationAudioToClipboard,
  deleteGeneration,
  updateGenerationTitle,
} from "../api/tauri";
import { usePlayback } from "../context/PlaybackContext";
import { loadPlainTextIntoEditor } from "../lib/editorTextLoad";
import { deriveTitleFromText, displayTitle } from "../lib/generationTitle";
import { formatDurationMs } from "../lib/formatTime";
import {
  getSourceUi,
  hexToRgba,
  historyItemSurfaceStyle,
  resolveHistoryItemColor,
  sourceLabelForGeneration,
} from "../lib/historySourceUi";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import Icon from "./Icon";
import HistoryTextPreview from "./HistoryTextPreview";
import HistoryItemInlinePlayback from "./history/HistoryItemInlinePlayback";
import HistoryTokenInfoButton from "./history/HistoryTokenInfoButton";
import SoundboardAssignMenu from "./history/SoundboardAssignMenu";
import HistoryItemProfileAvatar from "./history/HistoryItemProfileAvatar";

interface Props {
  gen: Generation;
  folders: ArchiveFolder[];
  archiveTags?: ArchiveTag[];
  compact?: boolean;
  isCurrent: boolean;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onAssignSoundboard?: (generationId: string, slotIndex: number) => void;
  voiceProfiles?: TtsVoiceProfile[];
  tempHistoryMax?: number;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
}

const ACTION_ICON = 16;
const PLAY_ICON = 18;
const AVATAR_SIZE = 36;
const AVATAR_SIZE_COMPACT = 32;

const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, .history-action-group, .history-format-picker, [role='button'], [role='menuitem'], [contenteditable='true'], .history-item__select";

function FileStatusBadge({
  gen,
  folderLabel,
  tempHistoryMax,
}: {
  gen: Generation;
  folderLabel: string | null;
  tempHistoryMax?: number;
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
  const retentionHint =
    tempHistoryMax && tempHistoryMax > 0
      ? `Tymczasowy plik sesji (retencja: max ${tempHistoryMax} starszych pozycji)`
      : "Tymczasowy plik sesji";
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-200 border border-amber-500/25"
      title={retentionHint}
    >
      <Icon name="status-temp" size={10} />
      Temp
    </span>
  );
}

export default function HistoryItem({
  gen,
  folders,
  archiveTags = [],
  compact = false,
  isCurrent,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onAssignSoundboard,
  voiceProfiles = [],
  tempHistoryMax,
  selected = false,
  selectionMode = false,
  onToggleSelect,
}: Props) {
  const { playing } = usePlayback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const playHandler = onPlay ?? onSelect;
  const inputRef = useRef<HTMLInputElement>(null);
  const relative = useRelativeTime(gen.created_at);

  const isPlaying = isCurrent && playing;
  const accentColor = resolveHistoryItemColor(gen);
  const sourceUi = getSourceUi(gen.source);
  const resolvedVoiceProfile = resolveProfileForGeneration(gen, voiceProfiles);
  const profileDisplayName =
    resolvedVoiceProfile?.name ?? gen.voice?.trim() ?? "Profil usunięty";

  const date = new Date(gen.created_at);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const durationLabel = formatDurationMs(gen.duration_ms);
  const titleLabel = displayTitle(gen);
  const createdLabel = `${dateStr} · ${timeStr}`;

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
    if (trimmed === titleLabel) return;
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

  const folderLabel = gen.folder_id
    ? (folders.find((f) => f.id === gen.folder_id)?.name ?? "Folder")
    : null;

  const userTags = (gen.tag_ids ?? [])
    .map((id) => archiveTags.find((t) => t.id === id))
    .filter((t): t is ArchiveTag => Boolean(t));

  const handleCopyAudio = async () => {
    try {
      await copyGenerationAudioToClipboard(gen.id);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleCompactClick = () => {
    if (saving || selectionMode) return;
    onSelect(gen);
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (saving || selectionMode) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    onSelect(gen);
  };

  const cardStateClass = isCurrent
    ? isPlaying
      ? "history-item--playing border-accent"
      : "history-item--current border-accent"
    : "border-border";

  const selectionClass = selected ? "ring-2 ring-accent/70 bg-accent/5" : "";

  const selectCheckbox =
    selectionMode && onToggleSelect ? (
      <label
        className="history-item__select absolute top-1.5 left-1.5 z-10 flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded border-border accent-accent"
          aria-label={`Zaznacz ${titleLabel}`}
        />
      </label>
    ) : null;

  if (compact) {
    return (
      <div
        tabIndex={0}
        className={[
          "history-item history-item--compact relative min-w-0 overflow-hidden border rounded-md text-xs group",
          "flex flex-row items-stretch gap-2 py-1.5 px-2 transition-shadow duration-200",
          cardStateClass,
          selectionClass,
          isCurrent ? "bg-panel2" : "hover:brightness-110",
          saving ? "opacity-50 pointer-events-none" : selectionMode ? "" : "cursor-pointer",
        ].join(" ")}
        style={historyItemSurfaceStyle(accentColor, isCurrent)}
        onClick={selectionMode ? onToggleSelect : handleCompactClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selectionMode) onToggleSelect?.();
            else handleCompactClick();
          }
        }}
        title={gen.text.trim() || titleLabel}
        aria-label={`Odtwórz: ${titleLabel}, ${createdLabel}`}
      >
        {selectCheckbox}
        <HistoryItemProfileAvatar
          gen={gen}
          profile={resolvedVoiceProfile}
          size={AVATAR_SIZE_COMPACT}
          className="self-center"
        />
        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate text-[11px] font-semibold text-heading">
              {profileDisplayName}
            </span>
            <FileStatusBadge gen={gen} folderLabel={folderLabel} tempHistoryMax={tempHistoryMax} />
          </div>
          <span
            className={[
              "min-w-0 truncate text-[10px]",
              isPlaying ? "text-accent2" : "text-muted",
            ].join(" ")}
          >
            {titleLabel}
          </span>
        </div>
        <div className="shrink-0 flex flex-col items-end justify-center gap-0.5">
          <span className="text-[10px] text-muted tabular-nums whitespace-nowrap">{timeStr}</span>
          {gen.status === "done" && (gen.duration_ms ?? 0) > 0 && (
            <span className="text-[9px] text-muted/80 tabular-nums">{durationLabel}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "history-item relative min-w-0 overflow-hidden border rounded-md text-xs flex flex-row gap-2.5 p-2.5",
        cardStateClass,
        selectionClass,
        isCurrent ? "bg-panel2 history-item--expanded" : "hover:brightness-110",
        !saving && !isCurrent && !selectionMode ? "cursor-pointer" : "",
        saving ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
      style={historyItemSurfaceStyle(accentColor, isCurrent)}
      onClick={handleCardClick}
    >
      {selectCheckbox}
      <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
        <HistoryItemProfileAvatar gen={gen} profile={resolvedVoiceProfile} size={AVATAR_SIZE} />
        <button
          type="button"
          className="history-action-btn !p-1"
          onClick={() => playHandler(gen)}
          title="Odtwórz"
          aria-label="Odtwórz"
        >
          <Icon name="play" size={PLAY_ICON} />
        </button>
      </div>

      <div className="history-item-body flex flex-col flex-1 min-h-0 min-w-0 gap-1.5">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-heading truncate">
                {profileDisplayName}
              </span>
              <FileStatusBadge gen={gen} folderLabel={folderLabel} tempHistoryMax={tempHistoryMax} />
              <span
                className="text-[9px] rounded px-1 py-0.5"
                style={{
                  backgroundColor: hexToRgba(sourceUi.defaultColor, 0.2),
                  color: sourceUi.defaultColor,
                }}
              >
                {sourceLabelForGeneration(gen)}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-0.5 text-[10px] text-muted tabular-nums">
            <span>{createdLabel}</span>
            <span title="Długość nagrania">{durationLabel}</span>
            <span className="hidden sm:inline">{relative}</span>
          </div>
        </div>

        <div className="min-w-0 w-full overflow-hidden">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="block w-full min-w-0 max-w-full box-border text-[12px] font-medium bg-panel border border-accent rounded px-1.5 py-0.5 outline-none"
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
              className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[12px] font-medium leading-snug hover:text-accent2 disabled:opacity-50"
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
          {gen.origin_kind && (
            <span
              title={
                [gen.origin_user_name, gen.origin_user_id, gen.origin_platform_id]
                  .filter(Boolean)
                  .join(" · ") || gen.origin_kind
              }
            >
              <span className="text-muted/70">Bot:</span>{" "}
              {gen.origin_user_name
                ? `${gen.origin_kind}: ${gen.origin_user_name}`
                : gen.origin_kind}
            </span>
          )}
          <HistoryTokenInfoButton gen={gen} />
        </div>

        <div className="history-item__tags flex flex-wrap gap-1 min-w-0">
          <span className="tag">{gen.format.toUpperCase()}</span>
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

        <div className="history-item__actions flex shrink-0 flex-wrap items-center gap-1 pt-0.5">
          <button
            type="button"
            className="history-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              loadPlainTextIntoEditor(gen.text);
            }}
            title="Importuj tekst do edytora"
            aria-label="Importuj tekst"
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
            title="Kopiuj plik audio"
            aria-label="Kopiuj audio"
            disabled={saving || !gen.file_path?.trim()}
          >
            <Icon name="copy" size={ACTION_ICON} />
          </button>

          {onAssignSoundboard && gen.status === "done" && gen.file_path && (
            <div onClick={(e) => e.stopPropagation()}>
              <SoundboardAssignMenu
                disabled={saving}
                onAssign={(slot) => onAssignSoundboard(gen.id, slot)}
              />
            </div>
          )}

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
    </div>
  );
}
