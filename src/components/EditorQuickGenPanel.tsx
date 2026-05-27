import { useEffect, useState } from "react";
import {
  listVoiceboxModels,
  listVoiceboxProfiles,
  listVoices,
  voiceboxHealth,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import { getAppSettings } from "../api/tauri";
import type { EditorQuickGenSettings, EditorQuickGenSlot, TextFilterPreset } from "../appSettings";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { settingsStateToPreset, presetToSettingsState } from "../lib/quickHotkeyPreset";
import type { QuickHotkeyPreset, TtsVoiceProfile } from "../appSettings";
import { applyVoiceProfileToSlot } from "../lib/editorQuickGen";
import { resolveVoiceProfile } from "../lib/voiceProfiles";
import TtsPresetFields from "./TtsPresetFields";
import VoiceProfileSelect from "./VoiceProfileSelect";

interface Props {
  value: EditorQuickGenSettings;
  onChange: (next: EditorQuickGenSettings) => void;
  filterPresets: TextFilterPreset[];
  onError: (message: string) => void;
}

function slotToHotkeyShape(slot: EditorQuickGenSlot): QuickHotkeyPreset {
  return {
    id: "editor-slot",
    enabled: true,
    name: slot.label,
    shortcut: "",
    provider: slot.provider,
    model: slot.model,
    voice: slot.voice,
    style: slot.style,
    profile_id: slot.profile_id,
    language: slot.language,
    engine: slot.engine,
    minimax_speed: slot.minimax_speed,
    minimax_vol: slot.minimax_vol,
    minimax_pitch: slot.minimax_pitch,
    load_editor: false,
    autoplay: true,
    filter_preset_id: slot.filter_preset_id,
    format: slot.format,
    voice_profile_id: slot.voice_profile_id,
  };
}

function hotkeyShapeToSlot(base: EditorQuickGenSlot, preset: QuickHotkeyPreset): EditorQuickGenSlot {
  return {
    label: base.label,
    provider: preset.provider,
    model: preset.model,
    voice: preset.voice,
    style: preset.style,
    profile_id: preset.profile_id,
    language: preset.language,
    engine: preset.engine,
    minimax_speed: preset.minimax_speed,
    minimax_vol: preset.minimax_vol,
    minimax_pitch: preset.minimax_pitch,
    filter_preset_id: preset.filter_preset_id,
    format: preset.format,
    voice_profile_id: preset.voice_profile_id,
  };
}

function SlotEditor({
  title,
  slot,
  onChange,
  filterPresets,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealthState,
  voiceProfiles,
  onError,
}: {
  title: string;
  slot: EditorQuickGenSlot;
  onChange: (next: EditorQuickGenSlot) => void;
  filterPresets: TextFilterPreset[];
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: import("../ttsModels").TtsModelInfo[];
  voiceboxHealthState: VoiceBoxHealth | null;
  voiceProfiles: TtsVoiceProfile[];
  onError: (message: string) => void;
}) {
  const hotkey = slotToHotkeyShape(slot);
  const ttsState = presetToSettingsState(hotkey, voiceProfiles);
  const linkedProfile = resolveVoiceProfile(voiceProfiles, slot.voice_profile_id);

  return (
    <article className="border border-border rounded-lg bg-panel2/40 p-3 flex flex-col gap-3">
      <h4 className="text-xs font-medium text-muted uppercase tracking-wide">{title}</h4>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Etykieta na pasku
        <input
          className="field"
          value={slot.label}
          onChange={(e) => onChange({ ...slot, label: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Profil głosu
        <VoiceProfileSelect
          value={slot.voice_profile_id}
          onChange={(voiceProfileId) => {
            if (!voiceProfileId) {
              onChange({ ...slot, voice_profile_id: null });
              return;
            }
            const profile = resolveVoiceProfile(voiceProfiles, voiceProfileId);
            if (profile) {
              onChange(applyVoiceProfileToSlot(slot, profile));
            } else {
              onChange({ ...slot, voice_profile_id: voiceProfileId });
            }
          }}
        />
        {linkedProfile ? (
          <span className="text-[10px] text-muted/90">
            Używany profil: {linkedProfile.name} ({linkedProfile.provider})
          </span>
        ) : null}
      </label>
      <TtsPresetFields
        state={ttsState}
        voices={voices}
        voiceboxProfiles={voiceboxProfiles}
        voiceboxModels={voiceboxModels}
        voiceboxHealth={voiceboxHealthState}
        onChange={(s) => onChange(hotkeyShapeToSlot(slot, settingsStateToPreset(s, hotkey)))}
        onError={onError}
        compact
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1 text-muted">
          Filtr tekstu
          <select
            className="field"
            value={slot.filter_preset_id ?? ""}
            onChange={(e) =>
              onChange({ ...slot, filter_preset_id: e.target.value || null })
            }
          >
            <option value="">Aktywny preset z edytora</option>
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
            value={slot.format ?? ""}
            onChange={(e) => onChange({ ...slot, format: e.target.value || null })}
          >
            <option value="">Domyślny z ustawień</option>
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
            <option value="ogg">OGG</option>
          </select>
        </label>
      </div>
    </article>
  );
}

export default function EditorQuickGenPanel({
  value,
  onChange,
  filterPresets,
  onError,
}: Props) {
  const [voices, setVoices] = useState<string[]>([]);
  const [voiceboxProfiles, setVoiceboxProfiles] = useState<VoiceBoxProfile[]>([]);
  const [voiceboxModels, setVoiceboxModels] = useState<import("../ttsModels").TtsModelInfo[]>([]);
  const [voiceboxHealthState, setVoiceboxHealthState] = useState<VoiceBoxHealth | null>(null);
  const [voiceProfiles, setVoiceProfiles] = useState<TtsVoiceProfile[]>([]);

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

  return (
    <section className="flex flex-col gap-3">
      <p className="text-[11px] text-muted leading-relaxed">
        Przyciski Gen Ust 1 i Gen Ust 2 na pasku edytora używają tych presetów TTS (provider, głos,
        filtr, format).
      </p>
      <SlotEditor
        title="Gen Ust 1"
        slot={value.slot1}
        onChange={(slot1) => onChange({ ...value, slot1 })}
        filterPresets={filterPresets}
        voices={voices}
        voiceboxProfiles={voiceboxProfiles}
        voiceboxModels={voiceboxModels}
        voiceboxHealthState={voiceboxHealthState}
        voiceProfiles={voiceProfiles}
        onError={onError}
      />
      <SlotEditor
        title="Gen Ust 2"
        slot={value.slot2}
        onChange={(slot2) => onChange({ ...value, slot2 })}
        filterPresets={filterPresets}
        voices={voices}
        voiceboxProfiles={voiceboxProfiles}
        voiceboxModels={voiceboxModels}
        voiceboxHealthState={voiceboxHealthState}
        voiceProfiles={voiceProfiles}
        onError={onError}
      />
    </section>
  );
}
