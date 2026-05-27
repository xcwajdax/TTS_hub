import { useCallback, useEffect, useRef, useState } from "react";
import {
  listVoiceboxModels,
  listVoiceboxProfiles,
  listVoices,
  testQuickHotkeyPreset,
  voiceboxHealth,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import { getAppSettings } from "../api/tauri";
import type {
  QuickHotkeyPreset,
  QuickHotkeysSettings,
  TextFilterPreset,
  TtsVoiceProfile,
} from "../appSettings";
import { defaultQuickHotkeyPreset } from "../appSettings";
import {
  applyVoiceProfileToPreset,
  findShortcutConflict,
  migrateLegacyShortcut,
  presetToSettingsState,
  settingsStateToPreset,
  shortcutDisplayLabel,
  suggestShortcutForSlot,
} from "../lib/quickHotkeyPreset";
import { resolveVoiceProfile } from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { TtsModelInfo } from "../ttsModels";
import { useJobs } from "../context/JobsContext";
import ShortcutEditor from "./ShortcutEditor";
import TtsPresetFields from "./TtsPresetFields";
import VoiceProfileSelect from "./VoiceProfileSelect";

interface Props {
  value: QuickHotkeysSettings;
  onChange: (next: QuickHotkeysSettings) => void;
  filterPresets: TextFilterPreset[];
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export default function QuickHotkeysPanel({
  value,
  onChange,
  filterPresets,
  onError,
  onSuccess,
}: Props) {
  const { trackEnqueued } = useJobs();
  const [voices, setVoices] = useState<string[]>([]);
  const [voiceboxProfiles, setVoiceboxProfiles] = useState<VoiceBoxProfile[]>([]);
  const [voiceboxModels, setVoiceboxModels] = useState<TtsModelInfo[]>([]);
  const [voiceboxHealthState, setVoiceboxHealthState] = useState<VoiceBoxHealth | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [voiceProfiles, setVoiceProfiles] = useState<TtsVoiceProfile[]>([]);

  const migratedLegacy = useRef(false);
  useEffect(() => {
    if (migratedLegacy.current) return;
    const needs = value.presets.some((p) => p.shortcut.includes("Ctrl+Shift+Alt+"));
    if (!needs) return;
    migratedLegacy.current = true;
    onChange({
      ...value,
      presets: value.presets.map((p) => ({
        ...p,
        shortcut: migrateLegacyShortcut(p.shortcut),
      })),
    });
  }, [value, onChange]);

  useEffect(() => {
    listVoices().then(setVoices).catch(() => setVoices([]));
    listVoiceboxProfiles().then(setVoiceboxProfiles).catch(() => setVoiceboxProfiles([]));
    listVoiceboxModels().then(setVoiceboxModels).catch(() => setVoiceboxModels([]));
    voiceboxHealth().then(setVoiceboxHealthState).catch(() => setVoiceboxHealthState(null));
    const loadProfiles = () => {
      void getAppSettings()
        .then((view) => setVoiceProfiles(view.voice_profiles ?? []))
        .catch(() => setVoiceProfiles([]));
    };
    loadProfiles();
    window.addEventListener(VOICE_PROFILES_CHANGED, loadProfiles);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, loadProfiles);
  }, []);

  const updateMaster = (enabled: boolean) => onChange({ ...value, enabled });

  const updatePreset = (id: string, patch: Partial<QuickHotkeyPreset>) => {
    onChange({
      ...value,
      presets: value.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const usedShortcuts = () =>
    new Set(value.presets.map((p) => migrateLegacyShortcut(p.shortcut).toLowerCase()));

  const addPreset = () => {
    const preset = defaultQuickHotkeyPreset(`Skrót ${value.presets.length + 1}`);
    preset.shortcut = suggestShortcutForSlot(value.presets.length, usedShortcuts());
    onChange({ ...value, presets: [...value.presets, preset] });
    setExpandedId(preset.id);
  };

  const duplicatePreset = (preset: QuickHotkeyPreset) => {
    const copy: QuickHotkeyPreset = {
      ...preset,
      ...defaultQuickHotkeyPreset(`${preset.name} (kopia)`),
      shortcut: suggestShortcutForSlot(value.presets.length + 1, usedShortcuts()),
    };
    onChange({ ...value, presets: [...value.presets, copy] });
    setExpandedId(copy.id);
  };

  const removePreset = (id: string) => {
    if (value.presets.length <= 1) {
      onError("Musi pozostać co najmniej jeden preset.");
      return;
    }
    onChange({ ...value, presets: value.presets.filter((p) => p.id !== id) });
    if (expandedId === id) setExpandedId(value.presets.find((p) => p.id !== id)?.id ?? null);
  };

  const runTest = useCallback(
    async (presetId: string) => {
      setTestingId(presetId);
      try {
        const g = await testQuickHotkeyPreset(presetId);
        trackEnqueued(g);
        onSuccess?.(`Dodano do kolejki: ${g.title ?? presetId}`);
      } catch (e) {
        onError(String(e));
      } finally {
        setTestingId(null);
      }
    },
    [onError, onSuccess, trackEnqueued],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={value.enabled} onChange={(e) => updateMaster(e.target.checked)} />
          <span className="font-medium">Włącz globalne skróty szybkiego TTS</span>
        </label>
        <p className="text-[11px] text-muted leading-relaxed">
          Zaznacz tekst w innym oknie (przeglądarka, Notatnik, Word…), potem naciśnij skrót — TTS Hub wróci do
          tego okna, skopiuje zaznaczenie i wygeneruje mowę. Jeśli zamiast zaznaczenia czyta stary schowek,
          upewnij się, że zaznaczenie jest aktywne przed skrótem. Skróty z Shift (np. Shift+F3) są obsługiwane.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn text-xs" onClick={addPreset}>
          + Dodaj skrót
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {value.presets.map((preset) => {
          const expanded = expandedId === preset.id;
          const ttsState = presetToSettingsState(preset, voiceProfiles);
          const linkedProfile = resolveVoiceProfile(voiceProfiles, preset.voice_profile_id);
          const shortcut = migrateLegacyShortcut(preset.shortcut);
          const conflict = findShortcutConflict(shortcut, value.presets, preset.id);
          return (
            <article key={preset.id} className="border border-border rounded-lg bg-panel2/40 overflow-hidden">
              <header className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/60">
                <input
                  type="checkbox"
                  checked={preset.enabled}
                  onChange={(e) => updatePreset(preset.id, { enabled: e.target.checked })}
                  title="Włącz ten skrót"
                />
                <input
                  className="field flex-1 min-w-[120px] text-sm"
                  value={preset.name}
                  onChange={(e) => updatePreset(preset.id, { name: e.target.value })}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                {preset.shortcut ? (
                  <span
                    className="text-xs font-mono text-accent2 px-2 py-0.5 rounded border border-border bg-panel cursor-pointer"
                    title="Kliknij, aby edytować skrót"
                    onClick={() => setExpandedId(preset.id)}
                    onKeyDown={(e) => e.key === "Enter" && setExpandedId(preset.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {shortcutDisplayLabel(shortcut)}
                  </span>
                ) : (
                  <span className="text-xs text-muted italic">brak skrótu</span>
                )}
                <button type="button" className="btn text-xs" onClick={() => setExpandedId(expanded ? null : preset.id)}>
                  {expanded ? "Zwiń" : "Edytuj skrót i TTS"}
                </button>
                <button type="button" className="btn text-xs" onClick={() => duplicatePreset(preset)}>
                  Duplikuj
                </button>
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={testingId === preset.id}
                  onClick={() => void runTest(preset.id)}
                  title="Użyj aktualnego zaznaczenia w systemie"
                >
                  {testingId === preset.id ? "…" : "Test"}
                </button>
                <button type="button" className="btn text-xs text-red-300" onClick={() => removePreset(preset.id)}>
                  Usuń
                </button>
              </header>

              {expanded && (
                <div className="p-3 flex flex-col gap-4">
                  <ShortcutEditor
                    value={shortcut}
                    onChange={(next) => updatePreset(preset.id, { shortcut: migrateLegacyShortcut(next) })}
                    disabled={!value.enabled}
                    conflictMessage={
                      conflict ? `Ten skrót jest już używany przez „${conflict.name}".` : null
                    }
                  />
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Profil głosu
                    <VoiceProfileSelect
                      value={preset.voice_profile_id}
                      onChange={(voiceProfileId) => {
                        if (!voiceProfileId) {
                          updatePreset(preset.id, { voice_profile_id: null });
                          return;
                        }
                        const profile = resolveVoiceProfile(voiceProfiles, voiceProfileId);
                        if (profile) {
                          updatePreset(preset.id, applyVoiceProfileToPreset(preset, profile));
                        } else {
                          updatePreset(preset.id, { voice_profile_id: voiceProfileId });
                        }
                      }}
                    />
                    {linkedProfile ? (
                      <span className="text-[10px] text-muted/90">
                        Używany profil: {linkedProfile.name}
                      </span>
                    ) : null}
                  </label>
                  <TtsPresetFields
                    state={ttsState}
                    voices={voices}
                    voiceboxProfiles={voiceboxProfiles}
                    voiceboxModels={voiceboxModels}
                    voiceboxHealth={voiceboxHealthState}
                    onChange={(s) => updatePreset(preset.id, settingsStateToPreset(s, preset))}
                    onError={onError}
                    compact
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex flex-col gap-1 text-muted">
                      Filtr tekstu
                      <select
                        className="field"
                        value={preset.filter_preset_id ?? ""}
                        onChange={(e) =>
                          updatePreset(preset.id, {
                            filter_preset_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Brak (surowy tekst)</option>
                        {filterPresets.map((fp) => (
                          <option key={fp.id} value={fp.id}>
                            {fp.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-muted">
                      Format audio
                      <select
                        className="field"
                        value={preset.format ?? ""}
                        onChange={(e) =>
                          updatePreset(preset.id, {
                            format: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Domyślny z ustawień</option>
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preset.autoplay}
                        onChange={(e) => updatePreset(preset.id, { autoplay: e.target.checked })}
                      />
                      <span>Autoodtwarzanie po wygenerowaniu</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preset.load_editor}
                        onChange={(e) => updatePreset(preset.id, { load_editor: e.target.checked })}
                      />
                      <span>Wklej przechwycony tekst do edytora w TTS Hub</span>
                    </label>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
