import type { TtsVoiceProfile } from "../appSettings";
import { getVoiceAvatar, listSourceAvatars } from "../api/tauri";
import { inferGenerationProvider } from "./avatars";
import { displayTitle } from "./generationTitle";
import { getSourceUi } from "./historySourceUi";
import type { PlaybackToastViewModel } from "./playbackToastContract";
import { profileVoiceId, resolveProfileForGeneration } from "./voiceProfiles";
import type { Generation, GenerationSource, TtsProvider } from "../types";

export async function buildPlaybackToastModel(
  gen: Generation,
  profiles: TtsVoiceProfile[],
  queueLength?: number,
): Promise<PlaybackToastViewModel> {
  const profile = resolveProfileForGeneration(gen, profiles);
  const provider = (profile?.provider ?? gen.provider ?? inferGenerationProvider(gen)) as TtsProvider;
  const voiceId = profile ? profileVoiceId(profile) : (gen.voice ?? "").trim();

  let voiceAvatarPath: string | null = null;
  if (voiceId) {
    try {
      const info = await getVoiceAvatar(provider, voiceId);
      voiceAvatarPath = profile ? (info.path ?? null) : info.exists ? info.path : null;
    } catch {
      voiceAvatarPath = null;
    }
  }

  let sourceAvatars: Record<string, string> = {};
  try {
    sourceAvatars = await listSourceAvatars();
  } catch {
    sourceAvatars = {};
  }

  const sourceUi = getSourceUi(gen.source);
  const sourceAvatarPath = sourceAvatars[gen.source as GenerationSource] ?? null;

  return {
    generation: gen,
    title: displayTitle(gen),
    profileName: profile?.name ?? gen.voice?.trim() ?? null,
    voiceAvatarPath,
    source: {
      label: sourceUi.label,
      color: sourceUi.defaultColor,
      icon: sourceUi.icon,
      avatarPath: sourceAvatarPath || null,
    },
    isArchived: gen.is_archived,
    queueLength,
  };
}
