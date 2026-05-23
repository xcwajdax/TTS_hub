import { useEffect, useState } from "react";
import {
  listVoiceboxModels,
  listVoiceboxProfiles,
  listVoices,
  voiceboxHealth,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import type { SettingsState } from "../components/Settings";
import { isTauriApp } from "../lib/tauriEnv";
import { DEFAULT_TTS_MODEL, type TtsModelInfo } from "../ttsModels";

export const DEFAULT_TTS_SETTINGS: SettingsState = {
  provider: "google",
  model: DEFAULT_TTS_MODEL,
  voice: "Kore",
  voiceboxProfileId: "",
  language: "pl",
  style: "",
  multiSpeaker: false,
  speakers: [
    { speaker: "Mowca1", voice: "Kore" },
    { speaker: "Mowca2", voice: "Puck" },
  ],
  minimaxSpeed: 1,
  minimaxVol: 1,
  minimaxPitch: 0,
};

export function useTtsSettings(onError: (message: string) => void) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_TTS_SETTINGS);
  const [voices, setVoices] = useState<string[]>([]);
  const [voiceboxProfiles, setVoiceboxProfiles] = useState<VoiceBoxProfile[]>([]);
  const [voiceboxModels, setVoiceboxModels] = useState<TtsModelInfo[]>([]);
  const [voiceboxStatus, setVoiceboxStatus] = useState<VoiceBoxHealth | null>(null);

  useEffect(() => {
    if (!isTauriApp()) return;
    listVoices().then(setVoices).catch((e) => onError(String(e)));
    listVoiceboxProfiles()
      .then((profiles) => {
        setVoiceboxProfiles(profiles);
        setSettings((current) => {
          if (current.voiceboxProfileId || profiles.length === 0) return current;
          const profile = profiles[0];
          return {
            ...current,
            voiceboxProfileId: profile.id,
            language: profile.language,
          };
        });
      })
      .catch(() => setVoiceboxProfiles([]));
    listVoiceboxModels().then(setVoiceboxModels).catch(() => setVoiceboxModels([]));
    voiceboxHealth().then(setVoiceboxStatus).catch(() => setVoiceboxStatus(null));
  }, [onError]);

  return {
    settings,
    setSettings,
    voices,
    voiceboxProfiles,
    voiceboxModels,
    voiceboxStatus,
  };
}
