import { hexToRgba } from "../../lib/historySourceUi";
import type { PlaybackToastSourceView } from "../../lib/playbackToastContract";
import AvatarImage from "../avatars/AvatarImage";
import Icon from "../Icon";
import ProviderAvatar from "../ProviderAvatar";

interface Props {
  profileName: string | null;
  voiceAvatarPath: string | null;
  provider: string;
  source: PlaybackToastSourceView;
  size?: number;
}

export default function PlaybackToastIdentity({
  profileName,
  voiceAvatarPath,
  provider,
  source,
  size = 40,
}: Props) {
  const displayName = profileName ?? "?";

  return (
    <span className="relative inline-flex shrink-0" title={`${displayName} · ${source.label}`}>
      <ProviderAvatar
        provider={provider}
        filePath={voiceAvatarPath}
        fallbackLabel={displayName}
        size={size}
        className="ring-1 ring-border/60"
        badgePosition="top-left"
      />
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-panel overflow-hidden flex items-center justify-center"
        style={{
          width: 14,
          height: 14,
          backgroundColor: source.color,
          boxShadow: `0 0 0 1px ${hexToRgba(source.color, 0.5)}`,
        }}
        title={source.label}
        aria-hidden
      >
        {source.avatarPath ? (
          <AvatarImage filePath={source.avatarPath} size={12} className="rounded-full" />
        ) : (
          <Icon name={source.icon} size={10} className="text-white drop-shadow" />
        )}
      </span>
    </span>
  );
}
