import VoiceProfilesListPanel from "../../VoiceProfilesListPanel";
import { useAppView } from "../../../context/AppViewContext";
import type { TtsVoiceProfile } from "../../../appSettings";
import SettingsPageHeader from "../components/SettingsPageHeader";

interface Props {
  activeVoiceProfileId: string | null;
  onSelectVoiceProfile: (profile: TtsVoiceProfile) => void;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onProfileDeleted?: (profileId: string) => void;
}

export default function VoiceProfilesPage({
  activeVoiceProfileId,
  onSelectVoiceProfile,
  onError,
  onSuccess,
  onProfileDeleted,
}: Props) {
  const { openMinimaxVoices } = useAppView();

  const handleEditProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    openMinimaxVoices("profile");
    onSuccess?.(`Załadowano profil „${profile.name}" do edycji w Głosach Minimax.`);
  };

  return (
    <div className="flex flex-col gap-6 text-sm min-h-0">
      <SettingsPageHeader
        title="Profile głosu"
        description="Profil głosu to zapisany preset TTS: provider, model, głos i opcjonalny skrót klawiszowy. Nie myl z kluczem API (zakładka Providery) ani z profilem serwera Voice Box. Nowy profil tworzysz w zakładce Głosy Minimax → Profil TTS albo przyciskiem na dole panelu w widoku TTS."
      />
      <div className="border border-border rounded-md overflow-hidden min-h-[24rem] flex flex-col">
        <VoiceProfilesListPanel
          variant="settings"
          recentGenerations={[]}
          activeProfileId={activeVoiceProfileId}
          onSelectProfile={onSelectVoiceProfile}
          onEditProfile={handleEditProfile}
          onError={onError}
          onSuccess={onSuccess}
          onProfileDeleted={onProfileDeleted}
        />
      </div>
    </div>
  );
}
