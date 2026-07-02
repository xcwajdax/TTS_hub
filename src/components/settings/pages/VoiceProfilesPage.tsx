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
  const { openVoiceProfiles } = useAppView();

  const handleEditProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    openVoiceProfiles();
    onSuccess?.(`Załadowano profil „${profile.name}" do edycji.`);
  };

  return (
    <div className="flex flex-col gap-6 text-sm min-h-0">
      <SettingsPageHeader
        title="Profile głosu"
        description="Profil głosu TTS Hub to zapisany preset syntezy: provider, model i parametry. Edytuj w zakładce Profile Głosu (między TTS a Roleplay). Profil Voice Box na serwerze to osobna zakładka Voice Box → Profile."
      />
      <div className="flex gap-2">
        <button type="button" className="btn-primary text-xs" onClick={() => openVoiceProfiles()}>
          Otwórz edytor profili →
        </button>
      </div>
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
