import { useEffect, useState } from "react";
import Settings, { type SettingsState } from "./Settings";
import SaveVoiceProfileFooter from "./SaveVoiceProfileFooter";
import VoiceProfilesListPanel from "./VoiceProfilesListPanel";
import SettingsCreateVoicePanel from "./SettingsCreateVoicePanel";
import SettingsSidebarTab from "./SettingsSidebarTab";
import { getAppSettings, type VoiceBoxHealth, type VoiceBoxProfile } from "../api/tauri";
import type { TtsProviderId, TtsVoiceProfile } from "../appSettings";
import { voiceProfileToSettingsState } from "../lib/voiceProfiles";
import { isTauriApp } from "../lib/tauriEnv";
import type { TtsModelInfo } from "../ttsModels";
import type { Generation } from "../types";

type SidebarTab = "settings" | "profiles" | "create_voice";

interface Props {
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  recentGenerations: Generation[];
  onChange: (s: SettingsState) => void;
  onError: (message: string) => void;
  onProfileSaved?: (message: string) => void;
}

export default function SettingsSidebar({
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  recentGenerations,
  onChange,
  onError,
  onProfileSaved,
}: Props) {
  const [enabledProviders, setEnabledProviders] = useState<TtsProviderId[] | undefined>();
  const [tab, setTab] = useState<SidebarTab>("settings");

  useEffect(() => {
    if (!isTauriApp()) return;
    void getAppSettings().then((view) => {
      setEnabledProviders(view.enabled_providers);
    });
  }, []);

  const applyProfile = (profile: TtsVoiceProfile) => {
    onChange(voiceProfileToSettingsState(profile));
    setTab("settings");
  };

  const handleSuccess = (msg: string) => {
    onProfileSaved?.(msg);
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel border-r border-border">
      <div className="shrink-0 border-b border-border">
        <div
          className="settings-sidebar-tabs grid grid-cols-3 gap-0 px-0.5 pt-1"
          role="tablist"
          aria-label="Lewy panel TTS"
        >
          <SettingsSidebarTab
            active={tab === "settings"}
            label="Ustawienia"
            icon="info"
            onClick={() => setTab("settings")}
          />
          <SettingsSidebarTab
            active={tab === "profiles"}
            label="Profile"
            icon="folder-filled"
            onClick={() => setTab("profiles")}
          />
          <SettingsSidebarTab
            active={tab === "create_voice"}
            label="Nowy głos"
            icon="clip-insert"
            onClick={() => setTab("create_voice")}
          />
        </div>
      </div>

      {tab === "settings" ? (
        <>
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
          <SaveVoiceProfileFooter
            settings={settings}
            onError={onError}
            onSuccess={handleSuccess}
          />
        </>
      ) : tab === "profiles" ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <VoiceProfilesListPanel
            recentGenerations={recentGenerations}
            onEditProfile={applyProfile}
            onError={onError}
            onSuccess={handleSuccess}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto settings-create-voice-panel">
          <SettingsCreateVoicePanel
            settings={settings}
            onChange={onChange}
            onError={onError}
            onSuccess={handleSuccess}
          />
        </div>
      )}
    </div>
  );
}
