import type { TtsVoiceProfile } from "../appSettings";
import { useVoiceAvatar } from "../hooks/useAvatars";
import { profileVoiceId } from "../lib/voiceProfiles";
import type { TtsProvider } from "../types";
import ProviderAvatar from "./ProviderAvatar";

interface Props {
  profile: TtsVoiceProfile;
  preview: string;
  shortcutHint?: string | null;
  selected?: boolean;
  isReroute?: boolean;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export default function VoiceProfileChatRow({
  profile,
  preview,
  shortcutHint,
  selected,
  isReroute,
  onSelect,
  onContextMenu,
}: Props) {
  const voiceId = profileVoiceId(profile);
  const avatar = useVoiceAvatar(profile.provider as TtsProvider, voiceId);

  return (
    <button
      type="button"
      className={`voice-profile-chat-row w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-border/40 transition-colors ${
        selected ? "bg-accent/10" : "hover:bg-panel2/80"
      }`}
      title="Kliknij, aby wybrać profil. Prawy przycisk — menu."
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <ProviderAvatar
        provider={profile.provider as TtsProvider}
        filePath={avatar?.path ?? null}
        fallbackLabel={profile.name}
        size={44}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="text-sm font-medium text-heading truncate">{profile.name}</span>
          {isReroute ? (
            <span
              className="text-[9px] font-semibold uppercase tracking-wide text-accent2 shrink-0"
              title="Reroute globalny — wszystkie żądania API idą tym profilem"
            >
              Reroute
            </span>
          ) : shortcutHint ? (
            <span
              className="text-[9px] font-mono text-accent2/90 shrink-0"
              title={`Skrót: ${shortcutHint}`}
            >
              {shortcutHint}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted truncate leading-snug">
          {preview || "Brak wygenerowanego tekstu"}
        </p>
      </div>
    </button>
  );
}
