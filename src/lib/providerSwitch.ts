import type {
  MinimaxClonedVoice,
  MinimaxLanguageInfo,
  MinimaxModelInfo,
  MinimaxPresetVoice,
  VoiceBoxProfile,
} from "../api/tauri";
import type { IconSlug } from "./icons";
import type { TtsProvider } from "../types";
import type { SettingsState } from "../components/Settings";
import { DEFAULT_TTS_MODEL, FALLBACK_TTS_MODELS, type TtsModelInfo } from "../ttsModels";
import { DEFAULT_MINIMAX_LANGUAGE, DEFAULT_MINIMAX_VOICE_ID } from "../appSettings";
import { pickMinimaxVoiceForLanguage } from "./minimaxLanguages";

export interface ProviderTab {
  id: TtsProvider;
  label: string;
  icon: IconSlug;
}

export const PROVIDER_TABS: ProviderTab[] = [
  { id: "google", label: "Google Gemini", icon: "provider-google" },
  { id: "voicebox", label: "Voice Box", icon: "provider-voicebox" },
  { id: "minimax", label: "Minimax Portal", icon: "provider-minimax" },
];

const FALLBACK_VOICEBOX_MODELS: TtsModelInfo[] = [
  { id: "voicebox:chatterbox", display_name: "Voice Box Chatterbox" },
];

const DEFAULT_MINIMAX_MODEL = "minimax:speech-2.8-hd";

export interface ProviderSwitchContext {
  voices: string[];
  voiceboxModels: TtsModelInfo[];
  voiceboxProfiles: VoiceBoxProfile[];
  minimaxModels: MinimaxModelInfo[];
  minimaxLanguages: MinimaxLanguageInfo[];
  minimaxPresets: MinimaxPresetVoice[];
  minimaxCloned: MinimaxClonedVoice[];
  models: TtsModelInfo[];
  enabledLangs?: string[];
}

function minimaxModelOptions(
  minimaxModels: MinimaxModelInfo[],
): TtsModelInfo[] {
  return minimaxModels.map((m) => ({
    id: `minimax:${m.id}`,
    display_name: m.display_name,
  }));
}

function minimaxLangOptions(
  minimaxLanguages: MinimaxLanguageInfo[],
  enabledLangs?: string[],
): MinimaxLanguageInfo[] {
  if (!enabledLangs || enabledLangs.length === 0) return minimaxLanguages;
  const enabled = new Set(enabledLangs);
  return minimaxLanguages.filter((l) => enabled.has(l.code));
}

export function switchProviderState(
  state: SettingsState,
  provider: TtsProvider,
  ctx: ProviderSwitchContext,
): SettingsState {
  if (provider === state.provider) return state;

  if (provider === "voicebox") {
    const model = (ctx.voiceboxModels[0] ?? FALLBACK_VOICEBOX_MODELS[0]).id;
    const profile = ctx.voiceboxProfiles[0];
    return {
      ...state,
      provider,
      model,
      voice: profile?.name ?? state.voice,
      voiceboxProfileId: profile?.id ?? state.voiceboxProfileId,
      language: profile?.language ?? state.language,
      multiSpeaker: false,
    };
  }

  if (provider === "minimax") {
    const modelOptions = minimaxModelOptions(ctx.minimaxModels);
    const model = modelOptions[0]?.id ?? DEFAULT_MINIMAX_MODEL;
    const langOptions = minimaxLangOptions(ctx.minimaxLanguages, ctx.enabledLangs);
    const lang = langOptions[0]?.code ?? DEFAULT_MINIMAX_LANGUAGE;
    const clonedVoiceIds = new Set(ctx.minimaxCloned.map((v) => v.voice_id));
    const voice =
      pickMinimaxVoiceForLanguage(ctx.minimaxPresets, lang, state.voice, clonedVoiceIds) ||
      DEFAULT_MINIMAX_VOICE_ID;
    return {
      ...state,
      provider,
      model,
      language: lang,
      voice,
      multiSpeaker: false,
    };
  }

  const fallbackModels = ctx.models.length > 0 ? ctx.models : FALLBACK_TTS_MODELS;
  const model =
    fallbackModels.find((m) => m.id === DEFAULT_TTS_MODEL)?.id ??
    fallbackModels[0]?.id ??
    DEFAULT_TTS_MODEL;
  return {
    ...state,
    provider,
    model,
    voice: ctx.voices.includes(state.voice) ? state.voice : "Kore",
  };
}
