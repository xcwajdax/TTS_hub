import { useEffect, useMemo, useState } from "react";
import { formatModelLabel } from "../ttsModels";
import type { ArchiveFolder, ArchiveTag, Generation } from "../types";
import { getAppSettings } from "../api/tauri";
import { playbackAudioSrc } from "../api/tauri";
import { inferGenerationProvider } from "../lib/avatars";
import { displayTitle } from "../lib/generationTitle";
import { useVoiceAvatar } from "../hooks/useAvatars";
import {
  effectiveVoiceId,
  profileVoiceId,
  resolveProfileForGeneration,
  resolveVoiceProfile,
} from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { SettingsState } from "./Settings";
import ProviderAvatar from "./ProviderAvatar";
import PlaybackBarDetails from "./PlaybackBarDetails";
import TokenCostLabel from "./TokenCostLabel";
import WaveformPlayer from "./WaveformPlayer";
import type { TtsVoiceProfile } from "../appSettings";
import type { TtsProvider } from "../types";

interface Props {
  current: Generation | null;
  playNonce?: number;
  sessionIndex?: number;
  sessionTotal?: number;
  activeVoiceProfileId?: string | null;
  ttsSettings?: SettingsState;
  folders?: ArchiveFolder[];
  tags?: ArchiveTag[];
  onHistoryChanged?: () => void;
  onError?: (e: string) => void;
  onToast?: (message: string) => void;
}

const PLAYBACK_AVATAR_SIZE = 72;

export default function PlaybackBar({
  current,
  playNonce = 0,
  sessionIndex,
  sessionTotal,
  activeVoiceProfileId = null,
  ttsSettings,
  folders = [],
  tags = [],
  onHistoryChanged,
  onError,
  onToast,
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

  const generationProfile = useMemo(
    () => (current ? resolveProfileForGeneration(current, profiles) : null),
    [current, profiles],
  );

  const idleProfile = useMemo(
    () => resolveVoiceProfile(profiles, activeVoiceProfileId),
    [profiles, activeVoiceProfileId],
  );

  const displayProfile = current ? generationProfile : idleProfile;

  const provider = (
    displayProfile?.provider ??
    current?.provider ??
    ttsSettings?.provider ??
    (current ? inferGenerationProvider(current) : "google")
  ) as TtsProvider;

  const voiceId = displayProfile
    ? profileVoiceId(displayProfile)
    : current
      ? (current.voice ?? "").trim()
      : ttsSettings
        ? effectiveVoiceId(ttsSettings)
        : "";

  const voiceAvatar = useVoiceAvatar(provider, voiceId);

  const avatarLabel =
    displayProfile?.name ??
    current?.voice?.trim() ??
    (ttsSettings ? effectiveVoiceId(ttsSettings) || ttsSettings.voice : "Profil");

  const avatarCol = (
    <div className="playback-bar__avatar-col shrink-0 flex flex-col items-center gap-1.5 w-[88px]">
      <ProviderAvatar
        provider={provider}
        filePath={voiceAvatar?.path ?? null}
        fallbackLabel={avatarLabel}
        size={PLAYBACK_AVATAR_SIZE}
        className="playback-bar__avatar ring-[3px] ring-accent/50 shadow-lg"
        title={avatarLabel}
      />
      <span
        className="text-[11px] font-semibold text-heading text-center leading-tight line-clamp-2 w-full"
        title={avatarLabel}
      >
        {avatarLabel}
      </span>
    </div>
  );

  return (
    <div
      className="playback-bar shrink-0 border-t border-border bg-panel overflow-hidden flex flex-col"
      data-tour="playback"
    >
      {current ? (
        <WaveformPlayer
          key={`${current.id}-${playNonce}`}
          src={playbackAudioSrc(current.id)}
          current={current}
          folders={folders}
          tags={tags}
          onHistoryChanged={onHistoryChanged}
          onError={onError}
          onToast={onToast}
          renderLayout={({ controls, timeline, modals, headerCorner }) => (
            <>
              <div className="playback-bar__layout flex gap-4 min-w-0 px-4 pt-3 pb-2">
                {avatarCol}
                <div className="playback-bar__content relative flex-1 min-w-0 flex flex-col gap-1 pr-8">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(140px,220px)] items-start gap-3">
                    <div className="flex flex-col min-w-0">
                      <div className="text-sm font-medium truncate" title={current.text}>
                        {displayTitle(current)}
                      </div>
                      <div className="text-[10px] text-muted flex flex-wrap items-center gap-2 mt-1">
                        <span className="tag" title={current.model}>
                          {formatModelLabel(current.model)}
                        </span>
                        <span className="tag">{current.voice}</span>
                        <span className="tag">{current.format.toUpperCase()}</span>
                        <TokenCostLabel gen={current} />
                      </div>
                    </div>

                    <PlaybackBarDetails
                      gen={current}
                      sessionIndex={sessionIndex}
                      sessionTotal={sessionTotal}
                    />
                  </div>
                  {headerCorner && (
                    <div className="absolute top-0 right-0 z-10">{headerCorner}</div>
                  )}
                  {controls}
                </div>
              </div>
              {timeline}
              {modals}
            </>
          )}
        />
      ) : (
        <div className="playback-bar__idle px-4 py-2 text-sm text-muted">
          Brak aktywnej generacji. Wybierz profil i wygeneruj tekst powyżej.
        </div>
      )}
    </div>
  );
}
