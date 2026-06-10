import type { TtsVoiceProfile } from "../appSettings";
import { useVoiceAvatar } from "../hooks/useAvatars";
import { profileVoiceId } from "../lib/voiceProfiles";
import type { TtsProvider } from "../types";
import AvatarImage from "./avatars/AvatarImage";

type Size = "xs" | "sm" | "md";

interface Props {
  /**
   * The resolved voice profile. When `null` (profile deleted, no match),
   * the badge renders a neutral placeholder labelled "Profil usunięty"
   * (or `fallbackLabel`) with a tooltip showing the original voice name.
   */
  profile: TtsVoiceProfile | null;
  /**
   * Raw voice identifier (e.g. "Kore", "Polish_female_1_sample1"). Used as
   * the fallback tooltip when the profile cannot be resolved.
   */
  fallbackVoice?: string | null;
  /**
   * Override for the placeholder text shown when `profile` is null. Default
   * is "Profil usunięty".
   */
  fallbackLabel?: string;
  /**
   * Visual size:
   *   xs — 16px circle, no name (used in compact history list rows)
   *   sm — 20px circle + truncated name (used in chat bubble headers)
   *   md — 32px circle + full name + provider/voice in tooltip (used in
   *        the history list provenance bar)
   */
  size?: Size;
  /**
   * Whether to show the profile name next to the avatar. Default depends on
   * `size` (off for `xs`, on for `sm`/`md`).
   */
  showName?: boolean;
  className?: string;
}

const SIZE_PX: Record<Size, number> = { xs: 16, sm: 20, md: 32 };

function describeProfile(p: TtsVoiceProfile): string {
  const lines = [
    `Profil: ${p.name}`,
    `Provider: ${p.provider}`,
    `Model: ${p.model}`,
    `Głos: ${p.voice}`,
  ];
  if (p.style?.trim()) lines.push(`Styl: ${p.style}`);
  return lines.join("\n");
}

export default function VoiceProfileBadge({
  profile,
  fallbackVoice,
  fallbackLabel,
  size = "sm",
  showName,
  className = "",
}: Props) {
  const px = SIZE_PX[size];
  const showNameResolved = showName ?? size !== "xs";
  const resolvedProvider = (profile?.provider ?? "google") as TtsProvider;
  const resolvedVoiceId = profile
    ? profileVoiceId(profile)
    : (fallbackVoice ?? "").trim();
  const avatar = useVoiceAvatar(resolvedProvider, resolvedVoiceId);
  const avatarPath = profile ? avatar?.path ?? null : null;

  if (!profile) {
    const title = fallbackVoice
      ? `Profil usunięty (głos: ${fallbackVoice})`
      : fallbackLabel ?? "Profil usunięty";
    if (!showNameResolved) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 ${className}`.trim()}
          title={title}
        >
          <AvatarImage
            filePath={null}
            fallbackLabel="?"
            size={px}
            className="opacity-60"
          />
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[10px] text-muted italic ${className}`.trim()}
        title={title}
      >
        <AvatarImage
          filePath={null}
          fallbackLabel="?"
          size={px}
          className="opacity-60"
        />
        <span className="truncate max-w-[140px]">
          {fallbackLabel ?? "Profil usunięty"}
        </span>
      </span>
    );
  }

  if (!showNameResolved) {
    return (
      <span
        className={`inline-flex items-center ${className}`.trim()}
        title={describeProfile(profile)}
      >
        <AvatarImage
          filePath={avatarPath}
          fallbackLabel={profile.name}
          size={px}
          className="shrink-0"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 ${className}`.trim()}
      title={describeProfile(profile)}
    >
      <AvatarImage
        filePath={avatarPath}
        fallbackLabel={profile.name}
        size={px}
        className="shrink-0"
      />
      <span className="truncate text-[10px] text-muted leading-tight">
        {profile.name}
      </span>
    </span>
  );
}
