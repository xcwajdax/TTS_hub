import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TtsVoiceProfile } from "../../appSettings";
import type { AudioFormat, Generation } from "../../types";
import {
  archiveGeneration,
  deleteGeneration,
  revealInExplorer,
  updateGenerationUiColor,
} from "../../api/tauri";
import { AUDIO_FORMATS, loadSaveFormat, storeSaveFormat } from "../../audioFormats";
import { promptExportGenerationAudio, promptExportGenerationMp4 } from "../../lib/exportGenerationMp3";
import { displayTitle } from "../../lib/generationTitle";
import { HISTORY_COLOR_PRESETS, resolveHistoryItemColor } from "../../lib/historySourceUi";
import { useVideoTemplatePicker } from "../../hooks/useVideoTemplatePicker";
import { openMp4Studio } from "../../mp4/openMp4Studio";
import { useAppView } from "../../context/AppViewContext";
import AppConfirmDialog from "../AppConfirmDialog";
import Icon from "../Icon";

interface Props {
  anchorX: number;
  anchorY: number;
  gen: Generation;
  voiceProfiles?: TtsVoiceProfile[];
  onChanged: () => void;
  onError: (e: string) => void;
  onClose: () => void;
}

type Submenu = "format" | "color" | null;

export default function HistoryGenerationContextMenu({
  anchorX,
  anchorY,
  gen,
  voiceProfiles = [],
  onChanged,
  onError,
  onClose,
}: Props) {
  const { selectedId } = useVideoTemplatePicker();
  const appView = useAppView();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchorX, top: anchorY });
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [saveFormat, setSaveFormat] = useState<AudioFormat>(loadSaveFormat);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (confirmDelete) return;
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
  }, [anchorX, anchorY, submenu, confirmDelete]);

  useEffect(() => {
    if (confirmDelete) return;
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
  }, [onClose, confirmDelete]);

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

  const accentColor = resolveHistoryItemColor(gen);
  const titleLabel = displayTitle(gen);
  const hasFile = Boolean(gen.file_path?.trim());
  const toggleSubmenu = (id: Submenu) => setSubmenu((prev) => (prev === id ? null : id));

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await deleteGeneration(gen.id);
      onChanged();
      onClose();
    } catch (e) {
      onError(String(e));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!confirmDelete &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Opcje generacji"
            className="fixed z-[200] min-w-[240px] py-1 rounded-lg border border-border bg-panel shadow-lg text-sm"
            style={{ left: position.left, top: position.top }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy || !hasFile}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
              onClick={() => {
                if (appView.openMp4Studio) {
                  appView.openMp4Studio(gen.id);
                } else {
                  openMp4Studio(gen.id);
                }
                onClose();
              }}
            >
              <Icon name="film" size={14} />
              Studio MP4…
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={busy || !hasFile}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
              onClick={() =>
                void run(async () => {
                  if (!gen.file_path?.trim()) throw new Error("Brak pliku audio");
                  await promptExportGenerationMp4(gen, voiceProfiles, selectedId);
                })
              }
            >
              <Icon name="clip-external" size={14} />
              Zapisz MP4 (WhatsApp)…
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={busy || !hasFile}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
              onClick={() =>
                void run(async () => {
                  if (!gen.file_path?.trim()) throw new Error("Brak pliku audio");
                  await promptExportGenerationAudio(gen, voiceProfiles);
                })
              }
            >
              <Icon name="save" size={14} />
              Zapisz MP3…
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={busy || !hasFile}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2"
              onClick={() =>
                void run(async () => {
                  if (!gen.file_path?.trim()) throw new Error("Brak pliku audio");
                  await revealInExplorer(gen.file_path);
                })
              }
            >
              <Icon name="folder-filled" size={14} />
              Pokaż w Eksploratorze
            </button>

            {!gen.is_archived && (
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
                            await archiveGeneration(gen.id, f);
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
                        title={c}
                        aria-label={`Kolor ${c}`}
                        onClick={() =>
                          void run(async () => {
                            await updateGenerationUiColor(gen.id, c);
                          }, false)
                        }
                      />
                    ))}
                  </div>
                  {gen.ui_color?.trim() && (
                    <button
                      type="button"
                      className="mt-1 text-[10px] text-muted hover:text-heading"
                      onClick={() =>
                        void run(async () => {
                          await updateGenerationUiColor(gen.id, null);
                        }, false)
                      }
                    >
                      Przywróć kolor źródła
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-border/60 my-1" />

            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className="w-full text-left px-3 py-2 text-xs hover:bg-panel2/80 disabled:opacity-40 flex items-center gap-2 text-red-300/90"
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="trash" size={14} />
              Usuń
            </button>
          </div>,
          document.body,
        )}
      {confirmDelete && (
        <AppConfirmDialog
          title="Usuń z historii"
          message={`Czy na pewno usunąć „${titleLabel}" z historii? Plik audio zostanie trwale usunięty.`}
          confirmLabel="Usuń"
          cancelLabel="Anuluj"
          danger
          onCancel={() => {
            setConfirmDelete(false);
            onClose();
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </>
  );
}
