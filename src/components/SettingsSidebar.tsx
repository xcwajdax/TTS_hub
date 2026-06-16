import VoiceProfilesListPanel from "./VoiceProfilesListPanel";
import type { TtsVoiceProfile } from "../appSettings";
import { useAppView } from "../context/AppViewContext";
import type { Generation } from "../types";

interface Props {
  onError: (message: string) => void;
  recentGenerations?: Generation[];
  onProfileEdited?: (message: string) => void;
  onProfileDeleted?: (profileId: string) => void;
  activeVoiceProfileId: string | null;
  onSelectVoiceProfile: (profile: TtsVoiceProfile) => void;
}

export default function SettingsSidebar({
  onError,
  recentGenerations = [],
  onProfileEdited,
  onProfileDeleted,
  activeVoiceProfileId,
  onSelectVoiceProfile,
}: Props) {
  const { openSettingsTab, openMinimaxVoices, openVoiceboxView } = useAppView();

  const handleSelectProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    onProfileEdited?.(`Wybrano profil „${profile.name}".`);
  };

  const handleEditProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    if (profile.provider === "voicebox") {
      openVoiceboxView("tts_preset");
      onProfileEdited?.(`Załadowano profil „${profile.name}" — edycja w Voice Box.`);
      return;
    }
    openMinimaxVoices("profile");
    onProfileEdited?.(`Załadowano profil „${profile.name}" do edycji w Głosach Minimax.`);
  };

  return (
    <div
      className="flex flex-col h-full min-w-0 overflow-hidden bg-panel border-r border-border"
      data-tour="voice-sidebar"
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted">Dostępne profile</h2>
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
          onProfileDeleted={onProfileDeleted}
        />
      </div>
      <div className="shrink-0 border-t border-border bg-panel px-3 py-3">
        <button
          type="button"
          className="btn-primary text-xs w-full py-2"
          onClick={() => openMinimaxVoices("profile")}
        >
          Dodaj nowy profil
        </button>
      </div>
    </div>
  );
}
