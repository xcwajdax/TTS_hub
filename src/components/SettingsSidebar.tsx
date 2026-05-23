import { useEffect, useState } from "react";
import Settings, { type SettingsState } from "./Settings";
import { getAppSettings, type VoiceBoxHealth, type VoiceBoxProfile } from "../api/tauri";
import type { TtsProviderId } from "../appSettings";
import { isTauriApp } from "../lib/tauriEnv";
import type { TtsModelInfo } from "../ttsModels";

interface Props {
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  onChange: (s: SettingsState) => void;
  onError: (message: string) => void;
}

export default function SettingsSidebar({
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  onChange,
  onError,
}: Props) {
  const [enabledProviders, setEnabledProviders] = useState<TtsProviderId[] | undefined>();

  useEffect(() => {
    if (!isTauriApp()) return;
    void getAppSettings().then((view) => {
      setEnabledProviders(view.enabled_providers);
    });
  }, []);

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel border-r border-border">
      <div className="shrink-0 px-3 py-2.5 border-b border-border">
        <h2 className="text-sm font-semibold">Ustawienia TTS</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Settings
          state={settings}
          voices={voices}
          voiceboxProfiles={voiceboxProfiles}
          voiceboxModels={voiceboxModels}
          voiceboxHealth={voiceboxHealth}
          enabledProviders={enabledProviders}
          onChange={onChange}
          onError={onError}
        />
      </div>
    </div>
  );
}
