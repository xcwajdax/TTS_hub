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
  const { openMinimaxVoices, openVoiceboxView } = useAppView();

  const handleEditProfile = (profile: TtsVoiceProfile) => {
    onSelectVoiceProfile(profile);
    if (profile.provider === "voicebox") {
      openVoiceboxView("tts_preset");
      onSuccess?.(`Załadowano profil „${profile.name}" — edycja w Voice Box.`);
      return;
    }
    openMinimaxVoices("profile");
    onSuccess?.(`Załadowano profil „${profile.name}" do edycji w Głosach Minimax.`);
  };

  return (
    <div className="flex flex-col gap-6 text-sm min-h-0">
      <SettingsPageHeader
        title="Profile głosu"
        description="Profil głosu TTS Hub to zapisany preset syntezy: provider, model i parametry. To nie to samo co profil Voice Box na serwerze (zakładka Voice Box → Profile). Dla Minimax edytuj w Głosach Minimax; dla Voice Box — w zakładce Voice Box."
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
