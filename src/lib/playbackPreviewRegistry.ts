import type { StepPlaybackSettings, TextFilterPreset } from "./textFiltersTypes";
import type { TtsVoiceProfile } from "../appSettings";
import { FACTORY_VOICEOVER_BRIEF_ID } from "./filterPresetCatalog";

export type PlaybackPreviewMode = "karaoke-scroll" | "step-guide" | "compact-title";

export const DEFAULT_PLAYBACK_PREVIEW: PlaybackPreviewMode = "karaoke-scroll";

export function defaultStepPlaybackSettings(): StepPlaybackSettings {
  return {
    mode: "auto",
    min_steps: 2,
    synth_per_step: false,
    auto_advance: true,
    pause_between_ms: 0,
    show_intro: true,
  };
}

export function resolvePlaybackPreviewMode(
  preset: TextFilterPreset | null | undefined,
  profile?: TtsVoiceProfile | null,
): PlaybackPreviewMode {
  if (profile?.playback_preview_override) {
    return profile.playback_preview_override;
  }
  if (preset?.playback_preview) {
    return preset.playback_preview;
  }
  if (preset?.step_playback && preset.step_playback.mode !== "off") {
    return "step-guide";
  }
  if (preset?.id === FACTORY_VOICEOVER_BRIEF_ID) {
    return "compact-title";
  }
  return DEFAULT_PLAYBACK_PREVIEW;
}

export function shouldUseStepGuide(
  preset: TextFilterPreset | null | undefined,
  stepCount: number,
): boolean {
  const settings = preset?.step_playback;
  if (!settings || settings.mode === "off") return false;
  if (settings.mode === "force") return stepCount >= 1;
  return stepCount >= (settings.min_steps ?? 2);
}
