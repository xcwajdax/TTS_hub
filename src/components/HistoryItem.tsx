import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { formatModelLabel } from "../ttsModels";
import type { AudioFormat, Generation } from "../types";
import { useRelativeTime } from "../hooks/useRelativeTime";
import { archiveGeneration, deleteGeneration, revealInExplorer, updateGenerationTitle } from "../api/tauri";
import { loadSaveFormat } from "../audioFormats";
import { usePlayback } from "../context/PlaybackContext";
import { deriveTitleFromText, displayTitle } from "../lib/generationTitle";
import {
  HISTORY_PREFS_CHANGED,
  loadHistoryClickToPlay,
} from "../lib/historyPlaybackPrefs";
import Icon from "./Icon";
import HistoryItemPlayOverlay from "./HistoryItemPlayOverlay";
import SaveSplitButton from "./SaveSplitButton";

interface Props {
  gen: Generation;
  isCurrent: boolean;
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

const ACTION_ICON = 16;

const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, .history-action-group, .history-format-picker, .history-play-overlay, [role='button'], [role='menuitem'], [contenteditable='true']";

export default function HistoryItem({ gen, isCurrent, onPlay, onChanged, onError }: Props) {
  const { playing, level, togglePlay, restart } = usePlayback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [clickToPlay, setClickToPlay] = useState(loadHistoryClickToPlay);
  const inputRef = useRef<HTMLInputElement>(null);
  const relative = useRelativeTime(gen.created_at);

  const isPlaying = isCurrent && playing;
  const showPlayOverlay = isCurrent && clickToPlay;

  useEffect(() => {
    const sync = () => setClickToPlay(loadHistoryClickToPlay());
    window.addEventListener(HISTORY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(HISTORY_PREFS_CHANGED, sync);
  }, []);

  const date = new Date(gen.created_at);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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

    setSaving(true);
    try {
      if (titleChanged) {
        await updateGenerationTitle(gen.id, trimmed);
      }
      if (!gen.is_archived) {
        await archiveGeneration(gen.id, loadSaveFormat());
      }
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
  const handleReveal = async () => {
    try {
      await revealInExplorer(gen.file_path);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!clickToPlay || saving || isCurrent) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    onPlay(gen);
  };

  return (
    <div
      className={[
        "relative min-w-0 overflow-hidden p-2.5 pb-8 border rounded-md text-xs flex flex-col gap-1.5 transition-shadow duration-200",
        isCurrent ? "history-item--current border-accent bg-panel2" : "border-border bg-panel/60",
        isPlaying ? "history-item--playing" : "",
        clickToPlay && !saving && !isCurrent ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={handleCardClick}
    >
      {isPlaying && (
        <span className="history-item-now-playing" aria-live="polite">
          Odtwarzanie
        </span>
      )}

      <button
        type="button"
        className="history-action-btn history-action-btn--danger absolute top-1.5 right-1.5 z-30"
        onClick={(e) => {
          e.stopPropagation();
          void handleDelete();
        }}
        title="Usun"
        aria-label="Usun"
        disabled={saving}
      >
        <Icon name="x-circle" size={ACTION_ICON} />
      </button>

      <div
        className={[
          "history-item-body",
          showPlayOverlay ? "history-item-body--active" : "",
          isPlaying ? "history-item-body--playing" : "",
        ].join(" ")}
      >
        <div className="history-item-body__content flex flex-col gap-1.5">
          <div className="flex justify-between pr-6 text-[10px] text-muted">
            <span>
              {dateStr} · {timeStr}
            </span>
            <span>{relative}</span>
          </div>

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

          <p className="text-[12px] leading-snug text-muted line-clamp-2">{gen.text}</p>

          <div className="flex flex-wrap gap-1">
            <span className="tag" title={gen.model}>
              {formatModelLabel(gen.model)}
            </span>
            <span className="tag">{gen.voice}</span>
            <span className="tag">{gen.format.toUpperCase()}</span>
            {gen.is_archived && <span className="tag text-accent2">ARCHIVE</span>}
            {gen.source === "cursor" && (
              <span
                className="tag bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
                title={gen.conversation_id ? `Cursor · conv ${gen.conversation_id.slice(0, 8)}` : "Cursor"}
              >
                CURSOR
              </span>
            )}
            {gen.source === "http" && <span className="tag text-muted">HTTP</span>}
          </div>
        </div>

        {showPlayOverlay && (
          <HistoryItemPlayOverlay
            playing={playing}
            level={level}
            onTogglePlay={togglePlay}
            onRestart={restart}
          />
        )}
      </div>

      <div className="absolute bottom-1.5 left-1.5 z-30 flex items-center gap-1">
        <button
          type="button"
          className="history-action-btn"
          onClick={() => onPlay(gen)}
          title="Odtworz"
          aria-label="Odtworz"
        >
          <Icon name="play" size={ACTION_ICON} />
        </button>
        {!gen.is_archived && <SaveSplitButton onSave={handleArchive} disabled={saving} />}
        {gen.is_archived && (
          <button
            type="button"
            className="history-action-btn"
            onClick={handleReveal}
            title="Pokaz w Eksploratorze"
            aria-label="Pokaz w Eksploratorze"
          >
            <Icon name="folder" size={ACTION_ICON} />
          </button>
        )}
      </div>
    </div>
  );
}
