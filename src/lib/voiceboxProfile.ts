import type { VoiceBoxProfile } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import type { TtsModelInfo } from "../ttsModels";

export function voiceboxModelForProfile(
  profile: VoiceBoxProfile | undefined,
  currentModel: string,
  models: TtsModelInfo[],
): string {
  if (profile?.default_engine) {
    const preferred = `voicebox:${profile.default_engine}`;
    if (models.some((m) => m.id === preferred)) return preferred;
    return preferred;
  }
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