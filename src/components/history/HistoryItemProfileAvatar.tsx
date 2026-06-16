import type { TtsVoiceProfile } from "../../appSettings";
import { useVoiceAvatar } from "../../hooks/useAvatars";
import { inferGenerationProvider } from "../../lib/avatars";
import { getSourceUi, hexToRgba } from "../../lib/historySourceUi";
import { profileVoiceId } from "../../lib/voiceProfiles";
import type { Generation, GenerationSource, TtsProvider } from "../../types";
import ProviderAvatar from "../ProviderAvatar";

interface Props {
  gen: Generation;
  profile: TtsVoiceProfile | null;
  size?: number;
  className?: string;
}

export default function HistoryItemProfileAvatar({
  gen,
  profile,
  size = 36,
  className = "",
}: Props) {
  const sourceUi = getSourceUi(gen.source);
  const provider = (profile?.provider ?? gen.provider ?? inferGenerationProvider(gen)) as TtsProvider;
  const voiceId = profile
    ? profileVoiceId(profile)
    : (gen.voice ?? "").trim();
  const avatar = useVoiceAvatar(provider, voiceId);
  const avatarPath = profile ? avatar?.path ?? null : avatar?.exists ? avatar.path : null;
  const displayName = profile?.name ?? gen.voice?.trim() ?? "?";

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`.trim()}
      title={`${displayName} · ${sourceUi.label}`}
    >
      <ProviderAvatar
        provider={provider}
        filePath={avatarPath}
        fallbackLabel={displayName}
        size={size}
        className="ring-1 ring-border/60"
        badgePosition="top-left"
      />
      <SourceDot source={gen.source} color={sourceUi.defaultColor} />
    </span>
  );
}

function SourceDot({ source, color }: { source: GenerationSource; color: string }) {
  const ui = getSourceUi(source);
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-panel"
      style={{
        width: 12,
        height: 12,
        backgroundColor: color,
        boxShadow: `0 0 0 1px ${hexToRgba(color, 0.5)}`,
      }}
      title={ui.label}
      aria-hidden
    />
  );
}
