import type { EditorQuickGenSlot } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import type { TtsProvider } from "../types";

const DEFAULT_SPEAKERS = [
  { speaker: "Mowca1", voice: "Kore" },
  { speaker: "Mowca2", voice: "Puck" },
];

export function editorSlotToSettingsState(slot: EditorQuickGenSlot): SettingsState {
  return {
    provider: (slot.provider as TtsProvider) || "google",
    model: slot.model,
    voice: slot.voice,
    voiceboxProfileId: slot.profile_id ?? "",
    language: slot.language ?? "pl",
    style: slot.style ?? "",
    multiSpeaker: false,
    speakers: DEFAULT_SPEAKERS,
    minimaxSpeed: slot.minimax_speed ?? 1,
    minimaxVol: slot.minimax_vol ?? 1,
    minimaxPitch: slot.minimax_pitch ?? 0,
  };
}
