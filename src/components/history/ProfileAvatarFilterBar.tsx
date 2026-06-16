import type { TtsVoiceProfile } from "../../appSettings";
import type { TtsProvider } from "../../types";
import { useVoiceAvatar } from "../../hooks/useAvatars";
import {
  HISTORY_TOOLBAR_BTN,
  HISTORY_TOOLBAR_BTN_ACTIVE,
} from "../../lib/historyToolbar";
import type { ProfileFilterId } from "../../lib/historyProfileGroups";
import { profileVoiceId } from "../../lib/voiceProfiles";
import ProviderAvatar from "../ProviderAvatar";
import HistoryToolbarRow from "./HistoryToolbarRow";

interface Props {
  profiles: TtsVoiceProfile[];
  counts: Map<ProfileFilterId, number>;
  value: ProfileFilterId;
  onChange: (value: ProfileFilterId) => void;
  totalCount: number;
  unprofiledCount: number;
}

function ProfileChip({
  profileId,
  label,
  provider,
  avatarPath,
  count,
  active,
  onClick,
}: {
  profileId: string;
  label: string;
  provider: TtsProvider;
  avatarPath: string | null;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      key={profileId}
      type="button"
      className={`${HISTORY_TOOLBAR_BTN} !min-w-0 shrink-0 flex-col !h-auto !py-1 !px-1.5 gap-0.5 ${
        active ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
      }`}
      aria-pressed={active}
      title={`${label} (${count})`}
      onClick={onClick}
    >
      <ProviderAvatar
        provider={provider}
        filePath={avatarPath}
        fallbackLabel={label}
        size={28}
      />
      <span className="text-[9px] truncate max-w-[40px]">{label}</span>
      {count > 0 && (
        <span className="text-[8px] tabular-nums text-muted/70 leading-none">{count}</span>
      )}
    </button>
  );
}

function ProfileChipInner({ profile, count, active, onClick }: {
  profile: TtsVoiceProfile;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const avatar = useVoiceAvatar(profile.provider as TtsProvider, profileVoiceId(profile));
  return (
    <ProfileChip
      profileId={profile.id}
      label={profile.name}
      provider={profile.provider as TtsProvider}
      avatarPath={avatar?.path ?? null}
      count={count}
      active={active}
      onClick={onClick}
    />
  );
}

export default function ProfileAvatarFilterBar({
  profiles,
  counts,
  value,
  onChange,
  totalCount,
  unprofiledCount,
}: Props) {
  const sortedProfiles = [...profiles].sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return (
    <HistoryToolbarRow label="Profil" hint="Filtruj po głosie">
      <div
        className="flex gap-1 overflow-x-auto pb-0.5 min-w-0 scrollbar-thin"
        role="group"
        aria-label="Filtr profili głosowych"
      >
        <button
          type="button"
          className={`${HISTORY_TOOLBAR_BTN} !min-w-0 shrink-0 flex-col !h-auto !py-1 !px-2 gap-0.5 ${
            value === "__all__" ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
          }`}
          aria-pressed={value === "__all__"}
          title={`Wszystkie (${totalCount})`}
          onClick={() => onChange("__all__")}
        >
          <span className="text-[10px] font-medium">Wszystkie</span>
          <span className="text-[8px] tabular-nums text-muted/70">{totalCount}</span>
        </button>

        {sortedProfiles.map((profile) => {
          const count = counts.get(profile.id) ?? 0;
          if (count === 0 && value !== profile.id) return null;
          return (
            <ProfileChipInner
              key={profile.id}
              profile={profile}
              count={count}
              active={value === profile.id}
              onClick={() => onChange(profile.id)}
            />
          );
        })}

        {unprofiledCount > 0 && (
          <button
            type="button"
            className={`${HISTORY_TOOLBAR_BTN} !min-w-0 shrink-0 flex-col !h-auto !py-1 !px-1.5 gap-0.5 ${
              value === "__none__" ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
            }`}
            aria-pressed={value === "__none__"}
            title={`Bez profilu (${unprofiledCount})`}
            onClick={() => onChange("__none__")}
          >
            <ProviderAvatar
              provider="google"
              filePath={null}
              fallbackLabel="?"
              size={28}
              className="opacity-60"
              showProviderBadge={false}
            />
            <span className="text-[9px] truncate max-w-[40px]">Bez profilu</span>
            <span className="text-[8px] tabular-nums text-muted/70">{unprofiledCount}</span>
          </button>
        )}
      </div>
    </HistoryToolbarRow>
  );
}
