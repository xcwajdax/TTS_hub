import { useCallback, useState } from "react";
import type { TtsProviderId, TtsVoiceProfile } from "../../appSettings";
import { DEFAULT_TTS_SETTINGS } from "../../hooks/useTtsSettings";
import { useAppView } from "../../context/AppViewContext";
import VoiceProfilesListPanel from "../VoiceProfilesListPanel";
import SaveVoiceProfileFooter from "../SaveVoiceProfileFooter";
import VoiceProfileEditor from "./VoiceProfileEditor";
import type { SettingsState } from "../Settings";
import type { VoiceBoxHealth, VoiceBoxProfile } from "../../api/tauri";
import type { TtsModelInfo } from "../../ttsModels";

interface Props {
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  enabledProviders?: TtsProviderId[];
  activeVoiceProfileId: string | null;
  onSettingsChange: (s: SettingsState) => void;
  onSelectVoiceProfile: (profile: TtsVoiceProfile) => void;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onProfileSaved?: (m: string) => void;
}

export default function VoiceProfilesView({
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  enabledProviders,
  activeVoiceProfileId,
  onSettingsChange,
  onSelectVoiceProfile,
  onError,
  onSuccess,
  onProfileSaved,
}: Props) {
  const { onBackToTts } = useAppView();
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleSelectProfile = useCallback(
    (profile: TtsVoiceProfile) => {
      setEditingProfileId(profile.id);
      setEditingName(profile.name);
      onSelectVoiceProfile(profile);
      onSuccess?.(`Edytujesz profil „${profile.name}".`);
    },
    [onSelectVoiceProfile, onSuccess],
  );

  const handleNewProfile = () => {
    setEditingProfileId(null);
    setEditingName("");
    onSettingsChange({ ...DEFAULT_TTS_SETTINGS });
    onSuccess?.("Nowy profil — wybierz provider i parametry, potem zapisz.");
  };

  const handleSaved = (profile: TtsVoiceProfile) => {
    setEditingProfileId(profile.id);
    setEditingName(profile.name);
    onSelectVoiceProfile(profile);
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-panel">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-panel2/30">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-heading">Profile głosu</h1>
          <p className="text-[11px] text-muted truncate">
            Skonfiguruj provider, model i parametry. Po zapisaniu wróć do TTS i wybierz profil z listy.
          </p>
        </div>
        <button type="button" className="btn text-xs shrink-0" onClick={onBackToTts}>
          ← TTS
        </button>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(12rem,1fr)_minmax(0,2.2fr)]">
        <aside className="flex flex-col min-h-0 border-r border-border bg-panel">
          <div className="shrink-0 px-3 py-2 border-b border-border">
            <button type="button" className="btn-primary text-xs w-full py-2" onClick={handleNewProfile}>
              Nowy profil
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <VoiceProfilesListPanel
              activeProfileId={activeVoiceProfileId ?? editingProfileId}
              recentGenerations={[]}
              onSelectProfile={handleSelectProfile}
              onEditProfile={handleSelectProfile}
              onError={onError}
              onSuccess={onSuccess}
            />
          </div>
        </aside>

        <main className="flex flex-col min-h-0 min-w-0">
          <div className="flex-1 min-h-0 overflow-hidden border-b border-border">
            <VoiceProfileEditor
              state={settings}
              voices={voices}
              voiceboxProfiles={voiceboxProfiles}
              voiceboxModels={voiceboxModels}
              voiceboxHealth={voiceboxHealth}
              enabledProviders={enabledProviders}
              onChange={onSettingsChange}
              onError={onError}
            />
          </div>
          <SaveVoiceProfileFooter
            settings={settings}
            editingProfileId={editingProfileId}
            initialName={editingName}
            voiceProfileUi
            onError={onError}
            onSuccess={onProfileSaved ?? onSuccess}
            onSaved={handleSaved}
          />
        </main>
      </div>
    </div>
  );
}
