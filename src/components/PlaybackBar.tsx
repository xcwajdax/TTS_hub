import { formatModelLabel } from "../ttsModels";
import type { Generation } from "../types";
import { playbackAudioSrc } from "../api/tauri";
import { displayTitle } from "../lib/generationTitle";
import { PLAYBACK_BAR_GRID, WAVEFORM_MAX_WIDTH } from "../lib/playbackLayout";
import PlaybackBarDetails from "./PlaybackBarDetails";
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
  return (
    <div className={`h-full border-t border-border bg-panel px-4 overflow-hidden ${PLAYBACK_BAR_GRID}`}>
      {current ? (
        <>
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-medium truncate" title={current.text}>
              {displayTitle(current)}
            </div>
            <div className="text-[10px] text-muted flex flex-wrap gap-2 mt-0.5">
              <span className="tag" title={current.model}>
                {formatModelLabel(current.model)}
              </span>
              <span className="tag">{current.voice}</span>
              <span className="tag">{current.format.toUpperCase()}</span>
            </div>
          </div>

          <div className="flex justify-center min-w-0">
            <WaveformPlayer
              key={`${current.id}-${playNonce}`}
              src={playbackAudioSrc(current.id)}
              className={`w-full ${WAVEFORM_MAX_WIDTH}`}
            />
          </div>

          <PlaybackBarDetails
            gen={current}
            sessionIndex={sessionIndex}
            sessionTotal={sessionTotal}
          />
        </>
      ) : (
        <div className="col-span-3 text-sm text-muted">Brak aktywnej generacji. Wygeneruj cos powyzej.</div>
      )}
    </div>
  );
}
