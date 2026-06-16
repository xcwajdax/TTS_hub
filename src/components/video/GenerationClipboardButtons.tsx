import { useEffect, useState } from "react";
import { copyGenerationAudioToClipboard, copyGenerationMp4ToClipboard } from "../../api/tauri";
import { useVideoTemplatePicker } from "../../hooks/useVideoTemplatePicker";
import { promptExportGenerationMp4 } from "../../lib/exportGenerationMp3";
import {
  AUDIO_CLIPBOARD_SUCCESS_TOAST,
  MP4_CLIPBOARD_SUCCESS_TOAST,
  subscribeMp4ExportProgress,
  type Mp4ExportProgress,
} from "../../lib/mp4ExportProgress";
import type { Generation } from "../../types";
import Icon from "../Icon";

type Variant = "timeline" | "menu";

interface Props {
  gen: Generation | null;
  variant?: Variant;
  showTemplatePicker?: boolean;
  showSave?: boolean;
  className?: string;
  onError?: (msg: string) => void;
  onToast?: (msg: string) => void;
}

const ICON: Record<Variant, number> = {
  timeline: 14,
  menu: 16,
};

export default function GenerationClipboardButtons({
  gen,
  variant = "timeline",
  showTemplatePicker = false,
  showSave = false,
  className = "",
  onError,
  onToast,
}: Props) {
  const { templates, selectedId, setSelectedId, loading: templatesLoading } = useVideoTemplatePicker();
  const [copyingMp4, setCopyingMp4] = useState(false);
  const [copyingAudio, setCopyingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mp4Progress, setMp4Progress] = useState<Mp4ExportProgress | null>(null);

  const canUse = Boolean(gen?.file_path?.trim() && gen.status === "done");
  const busyMp4 = copyingMp4 || saving;
  const iconSize = ICON[variant];

  useEffect(() => {
    if (!gen?.id) return;
    let unsub: (() => void) | undefined;
    void subscribeMp4ExportProgress(gen.id, setMp4Progress).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [gen?.id]);

  useEffect(() => {
    if (!copyingMp4 && !saving) {
      const t = window.setTimeout(() => setMp4Progress(null), 600);
      return () => window.clearTimeout(t);
    }
  }, [copyingMp4, saving]);

  const handleCopyMp4 = async () => {
    if (!gen || !canUse) return;
    setCopyingMp4(true);
    setMp4Progress(null);
    try {
      const templateId = showTemplatePicker ? selectedId : null;
      await copyGenerationMp4ToClipboard(gen.id, templateId);
      onToast?.(MP4_CLIPBOARD_SUCCESS_TOAST);
    } catch (e) {
      onError?.(String(e));
    } finally {
      setCopyingMp4(false);
    }
  };

  const handleCopyAudio = async () => {
    if (!gen || !canUse) return;
    setCopyingAudio(true);
    try {
      await copyGenerationAudioToClipboard(gen.id, gen.format ?? "mp3");
      onToast?.(AUDIO_CLIPBOARD_SUCCESS_TOAST);
    } catch (e) {
      onError?.(String(e));
    } finally {
      setCopyingAudio(false);
    }
  };

  const handleSave = async () => {
    if (!gen || !canUse) return;
    setSaving(true);
    try {
      await promptExportGenerationMp4(gen, [], showTemplatePicker ? selectedId : null);
      onToast?.("MP4 zapisano na dysk.");
    } catch (e) {
      onError?.(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!gen) return null;

  const mp4Pct = Math.round((mp4Progress?.percent ?? (busyMp4 ? 0.04 : 0)) * 100);
  const showBar = busyMp4 || (mp4Progress != null && mp4Progress.phase !== "done");

  const mp4Btn = (
    <button
      type="button"
      disabled={!canUse || busyMp4 || copyingAudio}
      onClick={() => void handleCopyMp4()}
      className={[
        "generation-clipboard-btn generation-clipboard-btn--mp4",
        variant === "menu" ? "generation-clipboard-btn--menu" : "",
        variant === "timeline" ? "generation-clipboard-btn--timeline" : "",
      ].join(" ")}
      title="Kopiuj MP4 do schowka"
      aria-label="Kopiuj MP4 do schowka"
    >
      <Icon name="film" size={iconSize} />
      {variant === "menu" && <span>MP4</span>}
    </button>
  );

  const audioBtn = (
    <button
      type="button"
      disabled={!canUse || copyingAudio || busyMp4}
      onClick={() => void handleCopyAudio()}
      className={[
        "generation-clipboard-btn generation-clipboard-btn--audio",
        variant === "menu" ? "generation-clipboard-btn--menu" : "",
        variant === "timeline" ? "generation-clipboard-btn--timeline" : "",
      ].join(" ")}
      title="Kopiuj audio do schowka"
      aria-label="Kopiuj audio do schowka"
    >
      <Icon name="music-note" size={iconSize} />
      {variant === "menu" && <span>Audio</span>}
    </button>
  );

  if (variant === "menu") {
    return (
      <div className={`generation-clipboard-buttons generation-clipboard-buttons--menu ${className}`}>
        {showTemplatePicker && (
          <div className="px-3 py-2 border-b border-border/50">
            <label className="flex flex-col gap-1 text-[10px] text-muted">
              <span>Profil layoutu MP4</span>
              <select
                value={selectedId}
                disabled={templatesLoading || busyMp4 || templates.length === 0}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full text-xs bg-panel2 border border-border rounded px-2 py-1 text-foreground"
                aria-label="Profil layoutu MP4"
              >
                {templates.length === 0 ? (
                  <option value={selectedId}>Domyślny…</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        )}
        <div className="flex gap-2 px-3 py-2 border-b border-border/50">
          {mp4Btn}
          {audioBtn}
        </div>
      </div>
    );
  }

  return (
    <div className={`generation-clipboard-buttons flex flex-col min-w-0 ${className}`}>
      <div
        className={[
          "flex items-center min-w-0 gap-1.5",
        ].join(" ")}
      >
        {showTemplatePicker && (
          <label
            className="flex items-center gap-1 min-w-0 shrink text-muted mr-0.5"
            title="Profil layoutu MP4"
          >
            <select
              value={selectedId}
              disabled={templatesLoading || busyMp4 || templates.length === 0}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-transparent text-foreground cursor-pointer outline-none truncate max-w-[7rem] text-[10px] py-0"
              aria-label="Profil layoutu MP4"
            >
              {templates.length === 0 ? (
                <option value={selectedId}>Domyślny…</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {mp4Btn}
          {audioBtn}
        </div>

        {showSave && (
          <button
            type="button"
            disabled={!canUse || busyMp4}
            onClick={() => void handleSave()}
            className="shrink-0 flex items-center gap-1 text-[11px] text-muted hover:text-accent disabled:opacity-40 ml-1"
            title="Zapisz MP4 na dysk"
            aria-label="Zapisz MP4"
          >
            <Icon name="save" size={14} />
            <span>Zapisz</span>
          </button>
        )}
      </div>

      {showBar && (
        <div
          className="mt-1 h-[3px] w-full bg-panel2/90 rounded overflow-hidden"
          title={mp4Progress?.message ?? "Renderuję MP4…"}
          role="progressbar"
          aria-valuenow={mp4Pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(mp4Pct, busyMp4 ? 4 : 0)}%` }}
          />
        </div>
      )}
    </div>
  );
}
