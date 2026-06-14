import { confirm } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { formatModelLabel } from "../../ttsModels";
import type { TtsVoiceProfile } from "../../appSettings";
import type { ArchiveFolder, ArchiveTag, Generation } from "../../types";
import {
  deleteGeneration,
  updateGenerationTitle,
} from "../../api/tauri";
import { promptExportGenerationAudio, promptExportGenerationMp4 } from "../../lib/exportGenerationMp3";
import { usePlayback } from "../../context/PlaybackContext";
import { loadPlainTextIntoEditor } from "../../lib/editorTextLoad";
import { deriveTitleFromText, displayTitle } from "../../lib/generationTitle";
import { formatDurationMs } from "../../lib/formatTime";
import {
  getSourceUi,
  sourceLabelForGeneration,
} from "../../lib/historySourceUi";
import { resolveProfileForGeneration } from "../../lib/voiceProfiles";
import { useRelativeTime } from "../../hooks/useRelativeTime";
import Icon from "../Icon";
import HistoryTextPreview from "../HistoryTextPreview";
import HistoryTokenInfoButton from "./HistoryTokenInfoButton";
import HistoryItemProfileAvatar from "./HistoryItemProfileAvatar";

interface Props {
  folders: ArchiveFolder[];
  archiveTags: ArchiveTag[];
  voiceProfiles?: TtsVoiceProfile[];
  onPlay: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

const ACTION_ICON = 16;
const AVATAR_SIZE = 56;

export default function HistoryDetailPanel({
  folders,
  archiveTags = [],
  voiceProfiles = [],
  onPlay,
  onChanged,
  onError,
}: Props) {
  const { current } = usePlayback();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingVideo, setExportingVideo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const gen = current;
  const relative = useRelativeTime(gen?.created_at ?? 0);

  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [gen?.id]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!gen) {
    return (
      <aside className="history-detail-panel flex flex-col items-center justify-center h-full min-h-0 p-6 text-center border-l border-border bg-panel2/30">
        <Icon name="archive" size={32} className="opacity-30 mb-3" />
        <p className="text-sm text-muted">Wybierz generację z listy</p>
        <p className="text-[11px] text-muted/80 mt-1 max-w-[220px]">
          Kliknięcie załaduje tekst i nagranie do zakładki TTS bez auto-odtwarzania.
        </p>
      </aside>
    );
  }

  const resolvedVoiceProfile = resolveProfileForGeneration(gen, voiceProfiles);
  const profileDisplayName =
    resolvedVoiceProfile?.name ?? gen.voice?.trim() ?? "Profil usunięty";
  const titleLabel = displayTitle(gen);
  const sourceUi = getSourceUi(gen.source);
  const durationLabel = formatDurationMs(gen.duration_ms);
  const date = new Date(gen.created_at);
  const createdLabel = `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;

  const folderLabel = gen.folder_id
    ? (folders.find((f) => f.id === gen.folder_id)?.name ?? "Folder")
    : null;

  const userTags = (gen.tag_ids ?? [])
    .map((id) => archiveTags.find((t) => t.id === id))
    .filter((t): t is ArchiveTag => Boolean(t));

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

  const handleExportAudio = async () => {
    setExporting(true);
    try {
      await promptExportGenerationAudio(gen, voiceProfiles);
    } catch (e) {
      onError(String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleExportVideo = async () => {
    setExportingVideo(true);
    try {
      await promptExportGenerationMp4(gen, voiceProfiles);
    } catch (e) {
      onError(String(e));
    } finally {
      setExportingVideo(false);
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

  return (
    <aside className="history-detail-panel flex flex-col min-h-0 h-full border-l border-border bg-panel2/20 overflow-hidden">
      <div className="shrink-0 flex items-start gap-3 p-4 border-b border-border">
        <HistoryItemProfileAvatar
          gen={gen}
          profile={resolvedVoiceProfile}
          size={AVATAR_SIZE}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-heading truncate">
            {profileDisplayName}
          </span>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              className="w-full text-sm font-medium bg-panel border border-accent rounded px-2 py-1 outline-none"
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
              className="text-left text-sm font-medium text-heading hover:text-accent2 truncate"
              onClick={startEdit}
              disabled={saving}
              title={titleLabel}
            >
              {titleLabel}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
            <span>{createdLabel}</span>
            <span>·</span>
            <span>{durationLabel}</span>
            <span className="hidden xl:inline">· {relative}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <HistoryTextPreview text={gen.text} scroll={false} />
      </div>

      <div className="shrink-0 p-4 border-t border-border flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="tag" title={gen.model}>
            {formatModelLabel(gen.model)}
          </span>
          <span className="tag">{gen.voice}</span>
          <span className="tag">{gen.format.toUpperCase()}</span>
          <span
            className="tag"
            style={{
              backgroundColor: `color-mix(in srgb, ${sourceUi.defaultColor} 20%, transparent)`,
              color: sourceUi.defaultColor,
            }}
          >
            {sourceLabelForGeneration(gen)}
          </span>
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
          <HistoryTokenInfoButton gen={gen} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn text-xs flex items-center gap-1.5"
            onClick={() => onPlay(gen)}
          >
            <Icon name="play" size={ACTION_ICON} />
            Odtwórz
          </button>
          <button
            type="button"
            className="history-action-btn"
            onClick={() => loadPlainTextIntoEditor(gen.text)}
            title="Importuj tekst do edytora"
            disabled={!gen.text.trim()}
          >
            <Icon name="clip-insert" size={ACTION_ICON} />
          </button>
          <button
            type="button"
            className="history-action-btn"
            onClick={() => void handleExportVideo()}
            title="Zapisz MP4 z okładką (WhatsApp)"
            disabled={exporting || exportingVideo || !gen.file_path?.trim()}
          >
            <Icon name="clip-external" size={ACTION_ICON} />
          </button>
          <button
            type="button"
            className="history-action-btn"
            onClick={() => void handleExportAudio()}
            title="Zapisz MP3 z okładką i tytułem"
            disabled={exporting || exportingVideo || !gen.file_path?.trim()}
          >
            <Icon name="save" size={ACTION_ICON} />
          </button>
          <button
            type="button"
            className="history-action-btn history-action-btn--danger"
            onClick={() => void handleDelete()}
            title="Usuń"
          >
            <Icon name="trash" size={ACTION_ICON} />
          </button>
        </div>

        <p className="text-[10px] text-muted leading-snug">
          Zapis MP3/MP4 (dyskietka / strzałka) w zakładce Historia. Szybki panel: kopiuj MP4 do schowka.
        </p>
      </div>
    </aside>
  );
}
