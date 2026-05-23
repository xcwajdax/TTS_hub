import { formatModelLabel } from "../ttsModels";
import type { Generation } from "../types";
import { playbackAudioSrc } from "../api/tauri";
import { inferGenerationProvider } from "../lib/avatars";
import { displayTitle } from "../lib/generationTitle";
import { useVoiceAvatar } from "../hooks/useAvatars";
import AvatarImage from "./avatars/AvatarImage";
import { PLAYBACK_BAR_GRID } from "../lib/playbackLayout";
import PlaybackBarDetails from "./PlaybackBarDetails";
import TokenCostLabel from "./TokenCostLabel";
import WaveformPlayer from "./WaveformPlayer";

interface Props {
  current: Generation | null;
  playNonce?: number;
  sessionIndex?: number;
  sessionTotal?: number;
}

export default function PlaybackBar({
  current,
  playNonce = 0,
  sessionIndex,
  sessionTotal,
}: Props) {
  const provider = current ? inferGenerationProvider(current) : "google";
  const voiceAvatar = useVoiceAvatar(provider, current?.voice ?? "");

  return (
    <div className="shrink-0 border-t border-border bg-panel px-4 py-2 overflow-hidden">
      {current ? (
        <div className="flex flex-col gap-2 min-w-0">
          <div className={PLAYBACK_BAR_GRID}>
            <div className="flex flex-col min-w-0">
              <div className="text-xs font-medium truncate" title={current.text}>
                {displayTitle(current)}
              </div>
              <div className="text-[10px] text-muted flex flex-wrap items-center gap-2 mt-0.5">
                <AvatarImage
                  filePath={voiceAvatar?.path}
                  fallbackLabel={current.voice}
                  size={20}
                />
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

          <WaveformPlayer
            key={`${current.id}-${playNonce}`}
            src={playbackAudioSrc(current.id)}
            className="w-full"
          />
        </div>
      ) : (
        <div className="text-sm text-muted py-2">
          Brak aktywnej generacji. Wygeneruj cos powyzej.
        </div>
      )}
    </div>
  );
}
