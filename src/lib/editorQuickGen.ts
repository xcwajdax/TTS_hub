import type { EditorQuickGenSlot, TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import { resolveTtsFromVoiceProfileId, voiceProfileToSettingsState } from "./voiceProfiles";
import type { TtsProvider } from "../types";
import { defaultMinimaxSynthesisOptions } from "./minimaxOptions";

const DEFAULT_SPEAKERS = [
  { speaker: "Mowca1", voice: "Kore" },
  { speaker: "Mowca2", voice: "Puck" },
];

function slotInlineSettingsState(slot: EditorQuickGenSlot): SettingsState {
  return {
    provider: (slot.provider as TtsProvider) || "google",
    model: slot.model,
    voice: slot.voice,
    voiceboxProfileId: slot.profile_id ?? "",
    language: slot.language ?? "pl",
    style: slot.style ?? "",
    voiceboxPersonalityEnabled: false,
    multiSpeaker: false,
    speakers: DEFAULT_SPEAKERS,
    minimaxSpeed: slot.minimax_speed ?? 1,
    minimaxVol: slot.minimax_vol ?? 1,
    minimaxPitch: slot.minimax_pitch ?? 0,
    minimaxOptions: slot.minimax_options
      ? { ...defaultMinimaxSynthesisOptions(), ...slot.minimax_options }
      : defaultMinimaxSynthesisOptions(),
  };
}

export function editorSlotToSettingsState(
  slot: EditorQuickGenSlot,
  voiceProfiles: TtsVoiceProfile[] = [],
): SettingsState {
  return resolveTtsFromVoiceProfileId(
    voiceProfiles,
    slot.voice_profile_id,
    slotInlineSettingsState(slot),
  );
}

export function applyVoiceProfileToSlot(
  slot: EditorQuickGenSlot,
  profile: TtsVoiceProfile,
): EditorQuickGenSlot {
  const tts = voiceProfileToSettingsState(profile);
  return {
    ...slot,
    voice_profile_id: profile.id,
    provider: tts.provider,
    model: tts.model,
    voice: tts.voice,
    style: tts.style.trim() ? tts.style : null,
    profile_id: tts.provider === "voicebox" ? tts.voiceboxProfileId || null : null,
    language:
      tts.provider === "voicebox" || tts.provider === "minimax" ? tts.language || null : null,
    minimax_speed: tts.provider === "minimax" ? tts.minimaxSpeed : null,
    minimax_vol: tts.provider === "minimax" ? tts.minimaxVol : null,
    minimax_pitch: tts.provider === "minimax" ? tts.minimaxPitch : null,
  };
}
