import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listVoiceboxModels,
  listVoiceboxProfiles,
  listVoices,
  syncVoiceboxProfileAvatars,
  listMinimaxClonedVoices,
  listMinimaxLanguages,
  listMinimaxModels,
  listMinimaxPresetVoices,
  minimaxHealth,
  voiceboxHealth,
  type MinimaxClonedVoice,
  type MinimaxHealth,
  type MinimaxLanguageInfo,
  type MinimaxModelInfo,
  type MinimaxPresetVoice,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import { effectiveMinimaxEnabledLanguages } from "../lib/minimaxLanguages";
import { DEFAULT_MINIMAX_LANGUAGE } from "../appSettings";
import { defaultMinimaxSynthesisOptions } from "../lib/minimaxOptions";
import type { SettingsState } from "../components/Settings";
import {
  MOCK_GOOGLE_VOICES,
  MOCK_VOICEBOX_PROFILES,
} from "../lib/mockUi";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { isTauriApp } from "../lib/tauriEnv";
import { notifyAvatarsChanged } from "../lib/avatars";
import { DEFAULT_TTS_MODEL, type TtsModelInfo } from "../ttsModels";

export const DEFAULT_TTS_SETTINGS: SettingsState = {
  provider: "google",
  model: DEFAULT_TTS_MODEL,
  voice: "Kore",
  voiceboxProfileId: "",
  language: "pl",
  style: "",
  voiceboxPersonalityEnabled: false,
  multiSpeaker: false,
  speakers: [
    { speaker: "Mowca1", voice: "Kore" },
    { speaker: "Mowca2", voice: "Puck" },
  ],
  minimaxSpeed: 1,
  minimaxVol: 1,
  minimaxPitch: 0,
  minimaxOptions: defaultMinimaxSynthesisOptions(),
};

export function useTtsSettings(onError: (message: string) => void) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_TTS_SETTINGS);
  const [voices, setVoices] = useState<string[]>([]);
  const [voiceboxProfiles, setVoiceboxProfiles] = useState<VoiceBoxProfile[]>([]);
  const [voiceboxModels, setVoiceboxModels] = useState<TtsModelInfo[]>([]);
  const [voiceboxStatus, setVoiceboxStatus] = useState<VoiceBoxHealth | null>(null);

  const [minimaxModels, setMinimaxModels] = useState<MinimaxModelInfo[]>([]);
  const [minimaxPresets, setMinimaxPresets] = useState<MinimaxPresetVoice[]>([]);
  const [minimaxCloned, setMinimaxCloned] = useState<MinimaxClonedVoice[]>([]);
  const [minimaxLanguages, setMinimaxLanguages] = useState<MinimaxLanguageInfo[]>([]);
  const [minimaxEnabledLangs, setMinimaxEnabledLangs] = useState<string[]>([
    DEFAULT_MINIMAX_LANGUAGE,
  ]);
  const [minimaxStatus, setMinimaxStatus] = useState<MinimaxHealth | null>(null);

  const refreshVoicebox = useCallback(async () => {
    if (isMockUiMode()) {
      setVoiceboxProfiles(MOCK_VOICEBOX_PROFILES);
      setVoiceboxModels([{ id: "voicebox:chatterbox", display_name: "Chatterbox (mock)" }]);
      setVoiceboxStatus({
        status: "ok",
        model_loaded: true,
        model_downloaded: true,
        model_size: "mock",
        gpu_available: false,
        gpu_type: null,
        vram_used_mb: null,
        backend_type: "mock",
        backend_variant: null,
        gpu_compatibility_warning: null,
      });
      return;
    }
    if (!isTauriApp()) return;
    const [profiles, models, health] = await Promise.all([
      listVoiceboxProfiles().catch(() => [] as VoiceBoxProfile[]),
      listVoiceboxModels().catch(() => [] as TtsModelInfo[]),
      voiceboxHealth().catch(() => null),
    ]);
    setVoiceboxProfiles(profiles);
    setVoiceboxModels(models);
    setVoiceboxStatus(health);
    if (profiles.some((p) => p.avatar_path?.trim())) {
      void syncVoiceboxProfileAvatars()
        .then((count) => {
          if (count > 0) notifyAvatarsChanged();
        })
        .catch(() => {});
    }
    setSettings((current) => {
      if (current.voiceboxProfileId || profiles.length === 0) return current;
      const profile = profiles[0];
      return {
        ...current,
        voiceboxProfileId: profile.id,
        language: profile.language,
      };
    });
  }, []);

  useEffect(() => {
    if (isMockUiMode()) {
      setVoices(MOCK_GOOGLE_VOICES);
      setMinimaxModels([{ id: "speech-2.8-hd", display_name: "Speech 2.8 HD (mock)" }]);
      setMinimaxPresets([
        {
          voice_id: "Polish_female_1_sample1",
          display_name: "Polish Female 1 (mock)",
          language: "pl",
        },
      ]);
      setMinimaxCloned([]);
      setMinimaxLanguages([
        { code: "pl", language_boost: "pl", display_name: "Polski" },
        { code: "en", language_boost: "en", display_name: "English" },
      ]);
      setMinimaxEnabledLangs(["pl", "en"]);
      setMinimaxStatus({ configured: true, ok: true, message: "Mock" });
      void refreshVoicebox();
      return;
    }
    if (!isTauriApp()) return;
    listVoices().then(setVoices).catch((e) => onError(String(e)));
    void refreshVoicebox();

    listMinimaxModels().then(setMinimaxModels).catch(() => setMinimaxModels([]));
    listMinimaxPresetVoices().then(setMinimaxPresets).catch(() => setMinimaxPresets([]));
    listMinimaxClonedVoices().then(setMinimaxCloned).catch(() => setMinimaxCloned([]));
    listMinimaxLanguages()
      .then((langs) => {
        setMinimaxLanguages(langs);
        setMinimaxEnabledLangs(effectiveMinimaxEnabledLanguages(langs.map((l) => l.code)));
      })
      .catch(() => setMinimaxLanguages([]));
    minimaxHealth().then(setMinimaxStatus).catch(() => setMinimaxStatus(null));
  }, [onError, refreshVoicebox]);

  const minimaxLangOptions = useMemo(
    () => {
      const enabled = new Set(minimaxEnabledLangs);
      return minimaxLanguages.filter((l) => enabled.has(l.code));
    },
    [minimaxLanguages, minimaxEnabledLangs],
  );

  const clonedVoiceIds = useMemo(
    () => new Set(minimaxCloned.map((v) => v.voice_id)),
    [minimaxCloned],
  );

  return {
    settings,
    setSettings,
    voices,
    voiceboxProfiles,
    voiceboxModels,
    voiceboxStatus,
    refreshVoicebox,
    minimaxModels,
    minimaxPresets,
    minimaxCloned,
    minimaxLanguages,
    minimaxLangOptions,
    minimaxEnabledLangs,
    minimaxStatus,
    clonedVoiceIds,
  };
}
