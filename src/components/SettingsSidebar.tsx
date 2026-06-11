import { useEffect, useState } from "react";
import Settings, { type SettingsState } from "./Settings";
import SaveVoiceProfileFooter from "./SaveVoiceProfileFooter";
import VoiceProfilesListPanel from "./VoiceProfilesListPanel";
import {
  getAppSettings,
  openQuickSetupWindow,
  type MinimaxClonedVoice,
  type MinimaxLanguageInfo,
  type MinimaxModelInfo,
  type MinimaxPresetVoice,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import { isProviderEnabled, type TtsProviderId, type TtsVoiceProfile } from "../appSettings";
import { isTauriApp } from "../lib/tauriEnv";
import type { TtsModelInfo } from "../ttsModels";
import { useAppView } from "../context/AppViewContext";
import type { Generation } from "../types";
import { PROVIDER_TABS, switchProviderState, type ProviderSwitchContext } from "../lib/providerSwitch";
import Icon from "./Icon";

type ActiveTab = "provider" | "profiles";

interface Props {
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  minimaxModels: MinimaxModelInfo[];
  minimaxLanguages: MinimaxLanguageInfo[];
  minimaxPresets: MinimaxPresetVoice[];
  minimaxCloned: MinimaxClonedVoice[];
  minimaxEnabledLangs?: string[];
  onChange: (s: SettingsState) => void;
  onError: (message: string) => void;
  onProfileSaved?: (message: string) => void;
  recentGenerations?: Generation[];
  onProfileEdited?: (message: string) => void;
  activeVoiceProfileId: string | null;
  onSelectVoiceProfile: (profile: TtsVoiceProfile) => void;
}

export default function SettingsSidebar({
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  minimaxModels,
  minimaxLanguages,
  minimaxPresets,
  minimaxCloned,
  minimaxEnabledLangs,
  onChange,
  onError,
  onProfileSaved,
  recentGenerations = [],
  onProfileEdited,
  activeVoiceProfileId,
  onSelectVoiceProfile,
}: Props) {
  const [enabledProviders, setEnabledProviders] = useState<TtsProviderId[] | undefined>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("provider");
  const { openSettingsTab } = useAppView();

  useEffect(() => {
    if (!isTauriApp()) return;
    void getAppSettings().then((view) => {
      setEnabledProviders(view.enabled_providers);
    });
  }, []);

  const visibleProviderTabs = PROVIDER_TABS.filter(
    (t) => isProviderEnabled(enabledProviders, t.id) || settings.provider === t.id,
  );

  const handleSelectProvider = (id: TtsProviderId) => {
    const ctx: ProviderSwitchContext = {
      voices,
      voiceboxModels,
      voiceboxProfiles,
      minimaxModels,
      minimaxLanguages,
      minimaxPresets,
      minimaxCloned,
      models: [],
      enabledLangs: minimaxEnabledLangs,
    };
    onChange(switchProviderState(settings, id, ctx));
    setActiveTab("provider");
  };

  const handleAddProvider = () => {
    setActiveTab("provider");
    void openQuickSetupWindow().catch((e) => onError(String(e)));
  };

  const handleSelectProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    onProfileEdited?.(`Wybrano profil „${profile.name}”.`);
  };

  const handleEditProfile = (profile: TtsVoiceProfile) => {
    handleSelectProfile(profile);
    setActiveTab("provider");
    onProfileEdited?.(`Załadowano profil „${profile.name}” do edycji.`);
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-panel border-r border-border">
      <nav
        className="flex border-b border-border shrink-0 bg-panel"
        role="tablist"
        aria-label="Zakładki providerów i profili"
      >
        {visibleProviderTabs.map((tab) => {
          const active = activeTab === "provider" && settings.provider === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              onClick={() => handleSelectProvider(tab.id)}
              className={`flex-1 flex items-center justify-center py-2 min-w-0 ${
                active
                  ? "bg-panel2 text-heading border-b-2 border-accent"
                  : "text-muted hover:text-heading"
              }`}
              title={tab.label}
            >
              <Icon name={tab.icon} size={18} />
            </button>
          );
        })}
        <button
          type="button"
          role="tab"
          aria-selected={false}
          aria-label="Dodaj provider"
          onClick={handleAddProvider}
          className="flex-1 flex items-center justify-center py-2 min-w-0 text-muted/60 hover:text-heading"
          title="Dodaj nowy provider (otwiera okno Quick Setup)"
        >
          <Icon name="provider-add" size={18} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profiles"}
          aria-label="Profile głosu"
          onClick={() => setActiveTab("profiles")}
          className={`flex-1 flex items-center justify-center py-2 min-w-0 ${
            activeTab === "profiles"
              ? "bg-panel2 text-heading border-b-2 border-accent"
              : "text-muted hover:text-heading"
          }`}
          title="Profile głosu"
        >
          <Icon name="provider-profiles" size={18} />
        </button>
      </nav>

      {activeTab === "profiles" ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <h2 className="text-xs uppercase tracking-wide text-muted">Profile głosu</h2>
            <button
              type="button"
              className="btn text-[11px] py-0.5 px-2"
              onClick={() => openSettingsTab("voice_profiles")}
              title="Otwórz pełne ustawienia profili"
            >
              Zarządzaj →
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden">
            <VoiceProfilesListPanel
              recentGenerations={recentGenerations}
              activeProfileId={activeVoiceProfileId}
              onSelectProfile={handleSelectProfile}
              onEditProfile={handleEditProfile}
              onError={onError}
              onSuccess={onProfileEdited}
            />
          </div>
        </div>
      ) : (
        <>
          <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <h2 className="text-xs uppercase tracking-wide text-muted">TTS — wybór</h2>
            <button
              type="button"
              className="btn text-[11px] py-0.5 px-2"
              onClick={() => openSettingsTab("providers")}
              title="Otwórz ustawienia providerów"
            >
              Providery →
            </button>
          </header>
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
            onSuccess={onProfileSaved}
          />
        </>
      )}
    </div>
  );
}
