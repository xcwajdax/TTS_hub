import type { TtsVoiceProfile } from "../appSettings";
import ProviderAvatar from "../components/ProviderAvatar";
import { useVoiceAvatar } from "../hooks/useAvatars";
import { profileVoiceId } from "../lib/voiceProfiles";
import type { TtsProvider } from "../types";

interface Props {
  profile: TtsVoiceProfile;
  size?: number;
  className?: string;
}

export default function VoiceProfileAvatar({ profile, size = 32, className }: Props) {
  const voiceId = profileVoiceId(profile);
  const avatar = useVoiceAvatar(profile.provider as TtsProvider, voiceId);

  return (
    <ProviderAvatar
      provider={profile.provider as TtsProvider}
      filePath={avatar?.path ?? null}
      fallbackLabel={profile.name}
      size={size}
      className={className}
    />
  );
}
