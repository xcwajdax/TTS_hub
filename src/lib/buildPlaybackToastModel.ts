import type { TtsVoiceProfile } from "../appSettings";
import { getVoiceAvatar, listSourceAvatars } from "../api/tauri";
import { inferGenerationProvider } from "./avatars";
import { displayTitle } from "./generationTitle";
import { getSourceUi } from "./historySourceUi";
import type { PlaybackToastViewModel } from "./playbackToastContract";
import {
  DEFAULT_PLAYBACK_PREVIEW,
  resolvePlaybackPreviewMode,
  shouldUseStepGuide,
} from "./playbackPreviewRegistry";
import { computeStepTimings } from "./stepPlayback/computeTimings";
import { parseSteps } from "./stepPlayback/parseSteps";
import { resolveActivePreset, type TextFiltersSettings } from "./textFiltersTypes";
import { profileVoiceId, resolveProfileForGeneration } from "./voiceProfiles";
import { isGenerationPinned } from "./playbackPinState";
import type { Generation, GenerationSource, TtsProvider } from "../types";

export interface BuildPlaybackToastModelOptions {
  queueLength?: number;
  textFilters?: TextFiltersSettings | null;
}

export async function buildPlaybackToastModel(
  gen: Generation,
  profiles: TtsVoiceProfile[],
  options: BuildPlaybackToastModelOptions = {},
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

  const preset = options.textFilters ? resolveActivePreset(options.textFilters) : null;
  const previewText = gen.text;
  let previewMode = resolvePlaybackPreviewMode(preset, profile);
  let steps: PlaybackToastViewModel["steps"];
  let intro: string | undefined;

  const stepSettings = preset?.step_playback;
  const parsed = parseSteps(previewText, {
    minSteps: stepSettings?.min_steps ?? 2,
    mode: stepSettings?.mode === "force" ? "force" : "auto",
  });

  if (shouldUseStepGuide(preset, parsed?.steps.length ?? 0) && parsed) {
    previewMode = "step-guide";
    const durationMs = gen.duration_ms ?? 60_000;
    const timings = computeStepTimings(parsed, durationMs, previewText);
    steps = timings.steps;
    intro = timings.intro;
  } else if (previewMode === "step-guide") {
    previewMode = DEFAULT_PLAYBACK_PREVIEW;
  }

  return {
    generation: gen,
    title: displayTitle(gen),
    profileName: profile?.name ?? gen.voice?.trim() ?? null,
    voiceAvatarPath,
    provider,
    source: {
      label: sourceUi.label,
      color: sourceUi.defaultColor,
      icon: sourceUi.icon,
      avatarPath: sourceAvatarPath || null,
    },
    isArchived: gen.is_archived,
    queueLength: options.queueLength,
    previewMode,
    previewText,
    steps,
    intro,
    filterPresetName: preset?.name,
    isPinned: isGenerationPinned(gen.id),
  };
}
