import type { VoiceBoxProfile } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import {
  FALLBACK_VOICEBOX_MODELS,
  shortModelLabel,
  type TtsModelInfo,
} from "../ttsModels";

export function voiceboxModelForProfile(
  profile: VoiceBoxProfile | undefined,
  currentModel: string,
  models: TtsModelInfo[],
): string {
  const has = (id: string) => models.some((m) => m.id === id);

  if (profile?.default_engine === "tada") {
    if (currentModel === "voicebox:tada-3b-ml" && has("voicebox:tada-3b-ml")) {
      return "voicebox:tada-3b-ml";
    }
    if (has("voicebox:tada-1b")) return "voicebox:tada-1b";
    if (has("voicebox:tada-3b-ml")) return "voicebox:tada-3b-ml";
    return "voicebox:tada-1b";
  }

  if (profile?.default_engine === "chatterbox") {
    return "voicebox:chatterbox";
  }

  if (profile?.default_engine) {
    const preferred = `voicebox:${profile.default_engine}`;
    if (has(preferred)) return preferred;
  }

  if (currentModel.startsWith("voicebox:") && has(currentModel)) return currentModel;
  if (currentModel.startsWith("voicebox:")) return currentModel;
  return models[0]?.id ?? "voicebox:chatterbox";
}

export function voiceboxServerProfileToHubProfile(
  vb: VoiceBoxProfile,
  models: TtsModelInfo[],
): TtsVoiceProfile {
  const model = voiceboxModelForProfile(vb, "voicebox:chatterbox", models);
  return {
    id: crypto.randomUUID(),
    name: vb.name.trim() || "Profil Voice Box",
    provider: "voicebox",
    model,
    voice: vb.name,
    style: null,
    profile_id: vb.id,
    language: vb.language,
    engine: vb.default_engine,
    personality_enabled: null,
    minimax_speed: null,
    minimax_vol: null,
    minimax_pitch: null,
    minimax_options: null,
    multi_speaker: false,
    speakers: [],
    shortcut: null,
    shortcut_enabled: false,
  };
}

export function hubProfileMatchesVoiceboxServer(
  hub: TtsVoiceProfile,
  vb: VoiceBoxProfile,
): boolean {
  if (hub.provider !== "voicebox") return false;
  const saved = (hub.profile_id ?? hub.voice).trim();
  return saved === vb.id || saved === vb.name.trim();
}

/** Models for the compact Voice Box picker; keeps the current value even if it is missing from the live list. */
export function voiceboxModelsForPicker(
  models: TtsModelInfo[],
  currentModel: string,
): TtsModelInfo[] {
  const base = models.length > 0 ? models : FALLBACK_VOICEBOX_MODELS;
  const labeled = base.map((m) => ({
    id: m.id,
    display_name: shortModelLabel(m.id, [m, ...base]),
  }));
  if (!currentModel.trim() || labeled.some((m) => m.id === currentModel)) return labeled;
  return [{ id: currentModel, display_name: shortModelLabel(currentModel) }, ...labeled];
}
