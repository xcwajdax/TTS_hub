import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TextFilterPreset, TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "./Settings";
import { useVoiceAvatar } from "../hooks/useAvatars";
import { buildActiveVoiceContext } from "../lib/activeVoiceContext";
import {
  effectiveVoiceId,
  profileVoiceId,
  resolveVoiceProfile,
} from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { TtsProvider } from "../types";
import AvatarImage from "./avatars/AvatarImage";
import Icon from "./Icon";
import ActiveVoiceContextPopover from "./textFilters/ActiveVoiceContextPopover";
import type { SettingsTabId } from "./settings/settingsTabs";

interface Props {
  ttsSettings: SettingsState;
  activeVoiceProfileId: string | null;
  activePreset?: TextFilterPreset | null;
  avatarSize?: number;
  className?: string;
  onOpenSettings?: (tab: SettingsTabId) => void;
}

export default function ActiveVoiceProfileHero({
  ttsSettings,
  activeVoiceProfileId,
  activePreset = null,
  avatarSize = 36,
  className = "",
  onOpenSettings,
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

  const context = useMemo(
    () => buildActiveVoiceContext(ttsSettings, activeProfile, activePreset),
    [ttsSettings, activeProfile, activePreset],
  );

  const provider = (activeProfile?.provider ?? ttsSettings.provider) as TtsProvider;
  const voiceId = activeProfile
    ? profileVoiceId(activeProfile)
    : effectiveVoiceId(ttsSettings);
  const avatar = useVoiceAvatar(provider, voiceId);

  const heroBody = (
    <>
      <AvatarImage
        filePath={avatar?.path ?? null}
        fallbackLabel={context.profileName}
        size={avatarSize}
        className="active-voice-profile-hero__avatar shrink-0"
        title={context.profileName}
      />
      <div className="active-voice-profile-hero__text flex flex-col min-w-0 gap-0.5">
        <span className="active-voice-profile-hero__name truncate max-w-[12rem] font-semibold text-heading text-xs leading-tight">
          {context.profileName}
        </span>
        <div className="active-voice-profile-hero__meta flex flex-nowrap items-center gap-1 min-w-0 text-[10px] text-muted leading-tight">
          <Icon
            name={context.providerIcon}
            size={12}
            className="active-voice-profile-hero__provider-icon shrink-0 opacity-80"
          />
          <span className="truncate max-w-[14rem]" title={context.barMetaLine}>
            {context.barMetaLine}
          </span>
          {context.barChips.map((chip) => (
            <span
              key={chip.label}
              className="active-voice-context-chip shrink-0"
              title={chip.title ?? chip.label}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </>
  );

  if (onOpenSettings) {
    return (
      <ActiveVoiceContextPopover
        context={context}
        onOpenSettings={onOpenSettings}
      >
        <div
          className={`active-voice-profile-hero flex items-center gap-2 shrink-0 min-w-0 ${className}`.trim()}
        >
          {heroBody}
        </div>
      </ActiveVoiceContextPopover>
    );
  }

  return (
    <div
      className={`active-voice-profile-hero flex items-center gap-2 shrink-0 min-w-0 ${className}`.trim()}
      title={context.barMetaLine}
    >
      {heroBody}
    </div>
  );
}
