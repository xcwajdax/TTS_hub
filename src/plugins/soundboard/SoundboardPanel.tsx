import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import ShortcutEditor from "../../components/ShortcutEditor";
import {
  clearSoundboardSlot,
  getSoundboard,
  listHistory,
  playSoundboardSlot,
  setSoundboardEnabled,
  setSoundboardSlot,
  updateSoundboardSlot,
} from "../../api/tauri";
import { shortcutDisplayLabel, validateShortcut } from "../../lib/quickHotkeyPreset";
import { notifyPluginsChanged } from "../events";
import type { Generation } from "../../types";
import type { SoundboardPublicView, SoundboardSlotPublic } from "../types";
import { displayTitle } from "../../lib/generationTitle";
import { mergeSessionAndArchiveHistory } from "../../lib/generationPlayback";
import { getMockSoundboardView } from "../../lib/mockUi";
import { isMockUiMode } from "../../lib/mockUi/isMockUiMode";
import { isTauriApp } from "../../lib/tauriEnv";

export const SOUNDBOARD_SLOTS_CHANGED = "soundboard:slots-changed";

export type SoundboardPanelVariant = "full" | "embedded";

interface Props {
  variant?: SoundboardPanelVariant;
  onBack?: () => void;
  onError: (message: string) => void;
  onToast?: (message: string) => void;
  /** When embedded in history sidebar — reuse list data for picker. */
  historyCandidates?: Generation[];
  onFilledCountChange?: (count: number) => void;
  /** Globalny przełącznik rozszerzenia (z huba / installed.json). */
  pluginEnabled?: boolean;
}

export default function SoundboardPanel({
  variant = "full",
  onBack,
  onError,
  onToast,
  historyCandidates,
  onFilledCountChange,
  pluginEnabled = true,
}: Props) {
  const embedded = variant === "embedded";
  const [view, setView] = useState<SoundboardPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [historyItems, setHistoryItems] = useState<Generation[]>([]);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [shortcutEditSlot, setShortcutEditSlot] = useState<number | null>(null);
  const [togglingPlugin, setTogglingPlugin] = useState(false);

  const refresh = useCallback(async () => {
    if (isMockUiMode()) {
      const sb = getMockSoundboardView();
      setView(sb);
      onFilledCountChange?.(sb.slots.filter((s) => s.hasAudio).length);
      setLoading(false);
      return;
    }
    if (!isTauriApp()) {
      setLoading(false);
      return;
    }
    try {
      const sb = await getSoundboard();
      setView(sb);
      const filled = sb.slots.filter((s) => s.hasAudio).length;
      onFilledCountChange?.(filled);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onError, onFilledCountChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSlotsChanged = () => void refresh();
    window.addEventListener(SOUNDBOARD_SLOTS_CHANGED, onSlotsChanged);
    return () => window.removeEventListener(SOUNDBOARD_SLOTS_CHANGED, onSlotsChanged);
  }, [refresh]);

  const resolvedHistoryItems = useMemo(() => {
    if (historyCandidates) {
      return historyCandidates
        .filter((g) => g.status === "done" && g.file_path)
        .slice(0, 80);
    }
    return historyItems;
  }, [historyCandidates, historyItems]);

  const openHistoryPicker = async (index: number) => {
    if (historyCandidates) {
      setPickerSlot(index);
      return;
    }
    try {
      const [session, archive] = await Promise.all([
        listHistory("session"),
        listHistory("archive"),
      ]);
      const done = mergeSessionAndArchiveHistory(session, archive).filter(
        (g) => g.status === "done" && g.file_path,
      );
      setHistoryItems(done.slice(0, 80));
      setPickerSlot(index);
    } catch (e) {
      onError(String(e));
    }
  };

  const assignGeneration = async (index: number, generationId: string) => {
    try {
      const next = await setSoundboardSlot(index, { generationId });
      setView(next);
      onFilledCountChange?.(next.slots.filter((s) => s.hasAudio).length);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
      setPickerSlot(null);
      onToast?.("Przypisano generację do slotu");
    } catch (e) {
      onError(String(e));
    }
  };

  const assignFile = async (index: number) => {
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg", "m4a", "flac"] }],
      });
      if (!picked || typeof picked !== "string") return;
      const next = await setSoundboardSlot(index, { filePath: picked });
      setView(next);
      onFilledCountChange?.(next.slots.filter((s) => s.hasAudio).length);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
      onToast?.("Przypisano plik do slotu");
    } catch (e) {
      onError(String(e));
    }
  };

  const onPlay = async (index: number) => {
    try {
      await playSoundboardSlot(index);
    } catch (e) {
      onError(String(e));
    }
  };

  const onClear = async (index: number) => {
    try {
      const next = await clearSoundboardSlot(index);
      setView(next);
      onFilledCountChange?.(next.slots.filter((s) => s.hasAudio).length);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
    } catch (e) {
      onError(String(e));
    }
  };

  const saveSlotMeta = async (
    index: number,
    patch: { label?: string; shortcut?: string; enabled?: boolean },
  ) => {
    try {
      const next = await updateSoundboardSlot(index, patch);
      setView(next);
      onFilledCountChange?.(next.slots.filter((s) => s.hasAudio).length);
      window.dispatchEvent(new CustomEvent(SOUNDBOARD_SLOTS_CHANGED));
      setEditSlot(null);
      setShortcutEditSlot(null);
    } catch (e) {
      onError(String(e));
    }
  };

  if (loading || !view) {
    return (
      <div
        className={`flex items-center justify-center text-muted text-sm ${
          embedded ? "py-8" : "h-full"
        }`}
      >
        Ładowanie soundboarda…
      </div>
    );
  }

  const conflictCount = view.slots.filter((s) => s.shortcutConflict).length;

  const togglePluginEnabled = async () => {
    setTogglingPlugin(true);
    try {
      const next = await setSoundboardEnabled(!pluginEnabled);
      setView(next);
      notifyPluginsChanged();
      onToast?.(pluginEnabled ? "Soundboard wyłączony" : "Soundboard włączony");
    } catch (e) {
      onError(String(e));
    } finally {
      setTogglingPlugin(false);
    }
  };

  return (
    <div className={`flex flex-col min-h-0 bg-panel ${embedded ? "flex-1" : "h-full"}`}>
      {!embedded && (
        <header className="shrink-0 px-6 py-4 border-b border-border flex items-center gap-4">
          {onBack && (
            <button
              type="button"
              className="text-sm text-muted hover:text-heading"
              onClick={onBack}
            >
              ← Hub
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-heading">Soundboard</h1>
            <p className="text-sm text-muted">
              8 slotów · własny globalny skrót na slot (domyślnie Ctrl+Shift+1–8)
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={pluginEnabled}
              disabled={togglingPlugin}
              onChange={() => void togglePluginEnabled()}
            />
            Włączone
          </label>
        </header>
      )}

      {embedded && (
        <div className="shrink-0 px-2 pt-2 pb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted leading-snug">
            Kliknij skrót na slocie, aby ustawić własny
          </p>
          <label className="flex items-center gap-1 text-[10px] text-heading cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="rounded scale-90"
              checked={pluginEnabled}
              disabled={togglingPlugin}
              onChange={() => void togglePluginEnabled()}
            />
            Wł.
          </label>
        </div>
      )}

      {!pluginEnabled && (
        <div
          className={`shrink-0 rounded border border-border bg-panel2 text-muted ${
            embedded ? "mx-2 mb-1 px-2 py-1.5 text-[10px]" : "mx-6 mt-4 px-3 py-2 text-sm"
          }`}
          role="status"
        >
          Soundboard jest wyłączony — globalne skróty nie działają. Włącz przełącznikiem powyżej
          lub w hubie Rozszerzeń.
        </div>
      )}

      {conflictCount > 0 && (
        <div
          className={`shrink-0 px-2 py-1.5 rounded border border-amber-600/50 bg-amber-950/30 text-amber-200 ${
            embedded ? "mx-2 text-[10px] leading-snug" : "mx-6 mt-4 text-sm"
          }`}
          role="alert"
        >
          {conflictCount === 1
            ? "Konflikt skrótu ze Szybkimi skrótami TTS."
            : `${conflictCount} sloty — konflikt skrótów TTS.`}
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-auto ${
          embedded ? "p-2" : "p-6"
        }`}
      >
        <div
          className={
            embedded
              ? "grid grid-cols-2 gap-2"
              : "grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto"
          }
        >
          {view.slots.map((slot) => (
            <SoundboardSlotCard
              key={slot.index}
              slot={slot}
              embedded={embedded}
              editing={editSlot === slot.index}
              shortcutEditing={shortcutEditSlot === slot.index}
              onEdit={() => {
                setShortcutEditSlot(null);
                setEditSlot(slot.index);
              }}
              onEditShortcut={() => {
                setEditSlot(null);
                setShortcutEditSlot(slot.index);
              }}
              onCancelEdit={() => {
                setEditSlot(null);
                setShortcutEditSlot(null);
              }}
              onSaveMeta={(patch) => void saveSlotMeta(slot.index, patch)}
              onSaveShortcut={(shortcut) => {
                if (!validateShortcut(shortcut)) {
                  onError("Nieprawidłowy skrót — użyj modyfikatorów (np. Ctrl+Shift+9) lub F9–F12.");
                  return;
                }
                void saveSlotMeta(slot.index, { shortcut });
              }}
              onPlay={() => void onPlay(slot.index)}
              onClear={() => void onClear(slot.index)}
              onPickHistory={() => void openHistoryPicker(slot.index)}
              onPickFile={() => void assignFile(slot.index)}
            />
          ))}
        </div>
      </div>

      {pickerSlot !== null && (
        <HistoryPickerModal
          items={resolvedHistoryItems}
          onClose={() => setPickerSlot(null)}
          onSelect={(id) => void assignGeneration(pickerSlot, id)}
        />
      )}
    </div>
  );
}

function SoundboardSlotCard({
  slot,
  embedded,
  editing,
  shortcutEditing,
  onEdit,
  onEditShortcut,
  onCancelEdit,
  onSaveMeta,
  onSaveShortcut,
  onPlay,
  onClear,
  onPickHistory,
  onPickFile,
}: {
  slot: SoundboardSlotPublic;
  embedded: boolean;
  editing: boolean;
  shortcutEditing: boolean;
  onEdit: () => void;
  onEditShortcut: () => void;
  onCancelEdit: () => void;
  onSaveMeta: (patch: { label?: string; shortcut?: string; enabled?: boolean }) => void;
  onSaveShortcut: (shortcut: string) => void;
  onPlay: () => void;
  onClear: () => void;
  onPickHistory: () => void;
  onPickFile: () => void;
}) {
  const [label, setLabel] = useState(slot.label);
  const [shortcut, setShortcut] = useState(slot.shortcut);
  const [enabled, setEnabled] = useState(slot.enabled);

  useEffect(() => {
    setLabel(slot.label);
    setShortcut(slot.shortcut);
    setEnabled(slot.enabled);
  }, [slot.label, slot.shortcut, slot.enabled]);

  return (
    <div
      className={`rounded-lg border flex flex-col gap-1.5 ${
        embedded ? "p-2 min-h-[108px]" : "p-3 gap-2 min-h-[140px]"
      } ${
        slot.shortcutConflict
          ? "border-amber-600/60 bg-amber-950/20"
          : "border-border bg-panel2"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] text-muted font-mono">#{slot.index + 1}</span>
        {!slot.enabled && <span className="text-[10px] text-muted">wył.</span>}
      </div>

      {shortcutEditing ? (
        <div className={`flex flex-col gap-2 ${embedded ? "text-xs" : "text-sm"}`}>
          <p className="text-[10px] text-muted">Własny skrót globalny</p>
          <ShortcutEditor
            value={shortcut}
            onChange={setShortcut}
            conflictMessage={
              slot.shortcutConflict ? "Skrót koliduje z innym (nie zarejestrowany)" : null
            }
          />
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 py-0.5 rounded bg-accent text-white text-[10px]"
              onClick={() => onSaveShortcut(shortcut)}
            >
              Zapisz skrót
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[10px] text-muted"
              onClick={onCancelEdit}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : editing ? (
        <div className={`flex flex-col gap-2 ${embedded ? "text-xs" : "text-sm"}`}>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted">Etykieta</span>
            <input
              className="rounded border border-border bg-panel px-2 py-0.5 text-heading text-xs"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <ShortcutEditor
            value={shortcut}
            onChange={setShortcut}
            conflictMessage={
              slot.shortcutConflict ? "Skrót koliduje z innym (nie zarejestrowany)" : null
            }
          />
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Włączony
          </label>
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              className="flex-1 py-0.5 rounded bg-accent text-white text-[10px] min-w-[3rem]"
              onClick={() => onSaveMeta({ label, shortcut, enabled })}
            >
              Zapisz
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[10px] rounded border border-border text-muted hover:text-heading disabled:opacity-40"
              disabled={!slot.hasAudio}
              onClick={onPlay}
            >
              Test
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[10px] text-muted"
              onClick={onCancelEdit}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <>
          <p
            className={`font-medium text-heading truncate ${embedded ? "text-xs" : "text-sm"}`}
            title={slot.label}
          >
            {slot.label}
          </p>
          <button
            type="button"
            className="text-left text-[10px] font-mono truncate text-accent/90 hover:underline w-full"
            title="Kliknij, aby zmienić skrót globalny"
            onClick={onEditShortcut}
          >
            {slot.shortcut
              ? shortcutDisplayLabel(slot.shortcut)
              : "Ustaw skrót…"}
          </button>
          {slot.shortcutConflict && (
            <p className="text-[9px] text-amber-400">Konflikt</p>
          )}
          {!embedded && (
            <p className="text-xs text-muted">
              {slot.hasAudio ? "Audio przypisane" : "Pusty slot"}
            </p>
          )}
          <div className={`mt-auto flex flex-wrap ${embedded ? "gap-0.5" : "gap-1"}`}>
            <button
              type="button"
              className="p-1 rounded bg-accent/20 text-accent"
              title="Odtwórz"
              disabled={!slot.hasAudio}
              onClick={onPlay}
            >
              <Icon name="play" size={embedded ? 14 : 16} />
            </button>
            {!embedded && (
              <button
                type="button"
                className="px-2 py-1 text-[10px] rounded border border-border text-muted hover:text-heading disabled:opacity-40"
                disabled={!slot.hasAudio}
                onClick={onPlay}
              >
                Test
              </button>
            )}
            <button
              type="button"
              className="px-1.5 py-0.5 text-[9px] rounded border border-border text-muted hover:text-heading"
              onClick={onPickHistory}
              title="Z historii"
            >
              {embedded ? "Hist." : "Historia"}
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[9px] rounded border border-border text-muted hover:text-heading"
              onClick={onPickFile}
            >
              Plik
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 text-[9px] rounded border border-border text-muted hover:text-heading"
              onClick={onEdit}
              aria-label="Edytuj slot"
            >
              ⋯
            </button>
            {slot.hasAudio && (
              <button
                type="button"
                className="p-1 rounded text-muted hover:text-red-400"
                title="Wyczyść"
                onClick={onClear}
              >
                <Icon name="x-circle" size={embedded ? 14 : 16} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryPickerModal({
  items,
  onClose,
  onSelect,
}: {
  items: Generation[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Wybierz generację"
    >
      <div className="bg-panel border border-border rounded-lg max-w-lg w-full max-h-[70vh] flex flex-col">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <h2 className="text-sm font-medium text-heading">Wybierz z historii</h2>
          <button type="button" className="text-muted text-sm" onClick={onClose}>
            Zamknij
          </button>
        </div>
        <ul className="overflow-auto flex-1 p-2">
          {items.length === 0 && (
            <li className="text-sm text-muted p-4 text-center">Brak gotowych generacji</li>
          )}
          {items.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded hover:bg-panel2 text-sm"
                onClick={() => onSelect(g.id)}
              >
                <span className="text-heading">{displayTitle(g)}</span>
                <span className="text-muted text-xs ml-2">{g.format}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
