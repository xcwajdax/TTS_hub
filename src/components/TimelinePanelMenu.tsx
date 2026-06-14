import { useEffect, useRef, useState } from "react";
import { useTimelineView } from "../context/TimelineViewContext";
import {
  TIMELINE_VIEW_DESCRIPTIONS,
  TIMELINE_VIEW_LABELS,
  TIMELINE_VIEW_MODES,
  type TimelineViewMode,
} from "../lib/timelineView";
import type { ArchiveFolder, ArchiveTag, AudioFormat, Generation } from "../types";
import {
  archiveGeneration,
  moveToFolder,
  revealInExplorer,
  setGenerationTags,
  updateGenerationUiColor,
} from "../api/tauri";
import { AUDIO_FORMATS, loadSaveFormat, storeSaveFormat } from "../audioFormats";
import { promptExportGenerationAudio, promptExportGenerationMp4 } from "../lib/exportGenerationMp3";
import { copyGenerationMp4ToClipboard } from "../api/tauri";
import { MP4_CLIPBOARD_SUCCESS_TOAST } from "../lib/mp4ExportProgress";
import { HISTORY_COLOR_PRESETS, resolveHistoryItemColor } from "../lib/historySourceUi";
import Icon from "./Icon";

interface Props {
  anchorX: number;
  anchorY: number;
  current: Generation | null;
  folders: ArchiveFolder[];
  tags: ArchiveTag[];
  onChanged: () => void;
  onError: (e: string) => void;
  onToast?: (message: string) => void;
  onClose: () => void;
}

type Submenu = "folder" | "color" | "tags" | "format" | null;

export default function TimelinePanelMenu({
  anchorX,
  anchorY,
  current,
  folders,
  tags,
  onChanged,
  onError,
  onToast,
  onClose,
}: Props) {
  const { mode, setMode } = useTimelineView();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchorX, top: anchorY });
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [saveFormat, setSaveFormat] = useState<AudioFormat>(loadSaveFormat);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = anchorX;
    let top = anchorY;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPosition({ left, top });
  }, [anchorX, anchorY, submenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const pickTimelineMode = (next: TimelineViewMode) => {
    void setMode(next);
    onClose();
  };

  const run = async (fn: () => Promise<void>, closeAfter = true) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (closeAfter) onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const accentColor = current ? resolveHistoryItemColor(current) : "#888";
  const assignedTags = new Set(current?.tag_ids ?? []);

  const toggleSubmenu = (id: Submenu) => setSubmenu((prev) => (prev === id ? null : id));

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Menu timeline"
      className="fixed z-[200] min-w-[240px] py-1 rounded-lg border border-border bg-panel shadow-lg text-sm"
      style={{ left: position.left, top: position.top }}
    >
      <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted border-b border-border/80">
        Wygląd timeline
      </p>
      {TIMELINE_VIEW_MODES.map((id) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${
              selected ? "bg-panel2 text-heading" : "hover:bg-panel2/80 text-foreground"
            }`}
            onClick={() => pickTimelineMode(id)}
          >
            <span className="flex items-center gap-2 font-medium text-xs">
              <span
                className={`w-3 h-3 rounded-full border shrink-0 ${
                  selected ? "border-accent bg-accent/30" : "border-border"
                }`}
                aria-hidden
              />
              {TIMELINE_VIEW_LABELS[id]}
            </span>
            <span className="text-[10px] text-muted pl-5">{TIMELINE_VIEW_DESCRIPTIONS[id]}</span>
          </button>
        );
      })}

      {current && (
        <>
          <p className="px-3 py-1.5 mt-1 text-[10px] uppercase tracking-wide text-muted border-t border-b border-border/80">
            Generacja
          </p>

          <button
            type="button"
            role="menuitem"
            disabled={busy || !current.file_path?.trim()}
            className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
            onClick={() =>
              void run(async () => {
                if (!current.file_path?.trim()) throw new Error("Brak pliku audio");
                await copyGenerationMp4ToClipboard(current.id);
                onToast?.(MP4_CLIPBOARD_SUCCESS_TOAST);
              })
            }
          >
            <Icon name="copy" size={14} />
            Kopiuj MP4 do schowka
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={busy || !current.file_path?.trim()}
            className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
            onClick={() =>
              void run(async () => {
                if (!current.file_path?.trim()) throw new Error("Brak pliku audio");
                await promptExportGenerationMp4(current);
              })
            }
          >
            <Icon name="clip-external" size={14} />
            Zapisz MP4 (WhatsApp)…
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={busy || !current.file_path?.trim()}
            className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
            onClick={() =>
              void run(async () => {
                if (!current.file_path?.trim()) throw new Error("Brak pliku audio");
                await promptExportGenerationAudio(current);
              })
            }
          >
            <Icon name="save" size={14} />
            Zapisz MP3…
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={busy || !current.file_path?.trim()}
            className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
            onClick={() =>
              void run(async () => {
                if (!current.file_path?.trim()) throw new Error("Brak pliku audio");
                await revealInExplorer(current.file_path);
              })
            }
          >
            <Icon name="folder-filled" size={14} />
            Pokaż w Eksploratorze (temp)
          </button>

          {!current.is_archived && (
            <div>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center justify-between gap-2"
                onClick={() => toggleSubmenu("format")}
              >
                <span className="flex items-center gap-2">
                  <Icon name="archive" size={14} />
                  Archiwizuj
                </span>
                <span className="text-muted text-[10px]">{saveFormat.toUpperCase()}</span>
              </button>
              {submenu === "format" && (
                <div className="border-t border-border/60 bg-panel2/50 py-1">
                  {AUDIO_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`w-full text-left px-4 py-1.5 text-[11px] hover:bg-panel2 ${
                        saveFormat === f ? "text-accent" : ""
                      }`}
                      onClick={() => {
                        setSaveFormat(f);
                        storeSaveFormat(f);
                        void run(async () => {
                          await archiveGeneration(current.id, f);
                        });
                      }}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {current.is_archived && (
            <div>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 flex items-center gap-2"
                onClick={() => toggleSubmenu("folder")}
              >
                <Icon name="folder" size={14} />
                Przenieś do folderu
              </button>
              {submenu === "folder" && (
                <div className="border-t border-border/60 bg-panel2/50 py-1 max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-1.5 text-[11px] hover:bg-panel2"
                    onClick={() =>
                      void run(async () => {
                        await moveToFolder(current.id, null);
                      })
                    }
                  >
                    Bez folderu (główne archiwum)
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-4 py-1.5 text-[11px] hover:bg-panel2"
                      onClick={() =>
                        void run(async () => {
                          await moveToFolder(current.id, f.id);
                        })
                      }
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 flex items-center gap-2"
              onClick={() => toggleSubmenu("color")}
            >
              <span
                className="w-3 h-3 rounded-sm border border-border shrink-0"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              />
              Kolor wpisu
            </button>
            {submenu === "color" && (
              <div className="border-t border-border/60 bg-panel2/50 p-2">
                <div className="grid grid-cols-4 gap-1">
                  {HISTORY_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-6 h-6 rounded border border-border/60 hover:scale-110"
                      style={{ backgroundColor: c }}
                      onClick={() =>
                        void run(async () => {
                          await updateGenerationUiColor(current.id, c);
                        }, false)
                      }
                    />
                  ))}
                </div>
                {current.ui_color?.trim() && (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-muted hover:text-heading"
                    onClick={() =>
                      void run(async () => {
                        await updateGenerationUiColor(current.id, null);
                      }, false)
                    }
                  >
                    Przywróć kolor źródła
                  </button>
                )}
              </div>
            )}
          </div>

          {current.is_archived && (
            <div>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 flex items-center justify-between gap-2"
                onClick={() => toggleSubmenu("tags")}
              >
                <span>Tagi</span>
                <span className="text-muted text-[10px]">{assignedTags.size || "—"}</span>
              </button>
              {submenu === "tags" && (
                <div className="border-t border-border/60 bg-panel2/50 py-1 max-h-40 overflow-y-auto">
                  {tags.length === 0 ? (
                    <p className="px-3 py-1 text-[10px] text-muted">Brak tagów</p>
                  ) : (
                    tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 px-3 py-1 text-[11px] hover:bg-panel2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assignedTags.has(tag.id)}
                          disabled={busy}
                          onChange={() => {
                            const next = new Set(assignedTags);
                            if (next.has(tag.id)) next.delete(tag.id);
                            else next.add(tag.id);
                            void run(async () => {
                              await setGenerationTags(current.id, [...next]);
                            }, false);
                          }}
                        />
                        {tag.name}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
