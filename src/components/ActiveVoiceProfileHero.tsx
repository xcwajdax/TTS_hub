import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "./Settings";
import { useVoiceAvatar } from "../hooks/useAvatars";
import {
  effectiveVoiceId,
  profileVoiceId,
  resolveVoiceProfile,
} from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { TtsProvider } from "../types";
import AvatarImage from "./avatars/AvatarImage";
import VoiceProfileSelect from "./VoiceProfileSelect";

interface Props {
  ttsSettings: SettingsState;
  activeVoiceProfileId: string | null;
  onVoiceProfileChange: (profileId: string | null) => void;
  avatarSize?: number;
  className?: string;
}

export default function ActiveVoiceProfileHero({
  ttsSettings,
  activeVoiceProfileId,
  onVoiceProfileChange,
  avatarSize = 52,
  className = "",
}: Props) {
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);

  useEffect(() => {
    const refresh = () => {
      void getAppSettings()
        .then((view) => setProfiles(view.voice_profiles ?? []))
        .catch(() => setProfiles([]));
    };
    refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, refresh);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refresh);
  }, []);

  const activeProfile = useMemo(
    () => resolveVoiceProfile(profiles, activeVoiceProfileId),
    [profiles, activeVoiceProfileId],
  );

  const provider = (activeProfile?.provider ?? ttsSettings.provider) as TtsProvider;
  const voiceId = activeProfile
    ? profileVoiceId(activeProfile)
    : effectiveVoiceId(ttsSettings);
  const avatar = useVoiceAvatar(provider, voiceId);

  const displayName = activeProfile?.name ?? "Własne ustawienia";
  const subtitle = activeProfile
    ? `${activeProfile.provider} · ${activeProfile.voice}`
    : `${ttsSettings.provider} · ${effectiveVoiceId(ttsSettings) || ttsSettings.voice}`;

  return (
    <div
      className={`active-voice-profile-hero flex items-center gap-3 shrink-0 min-w-0 ${className}`.trim()}
    >
      <AvatarImage
        filePath={avatar?.path ?? null}
        fallbackLabel={displayName}
        size={avatarSize}
        className="active-voice-profile-hero__avatar ring-2 ring-accent/45 shadow-md"
        title={displayName}
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-heading truncate leading-tight">
          {displayName}
        </span>
        <span className="text-[10px] text-muted truncate leading-snug">{subtitle}</span>
        <VoiceProfileSelect
          value={activeVoiceProfileId}
          onChange={onVoiceProfileChange}
          className="bg-panel2 border border-border rounded px-2 py-0.5 text-ink text-[11px] min-w-[120px] max-w-[200px] mt-0.5"
          emptyLabel="Własne ustawienia"
        />
      </div>
    </div>
  );
}
