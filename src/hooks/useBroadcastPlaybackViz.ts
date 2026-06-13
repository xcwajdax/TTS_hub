import { emitTo } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { usePlaybackAnalyser } from "./usePlaybackAnalyser";
import { isTauriApp } from "../lib/tauriEnv";
import { PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents } from "../lib/playbackToastContract";
import type { PlaybackVizFramePayload } from "../lib/playbackToastTypes";

const BAR_COUNT = 32;
const EMIT_INTERVAL_MS = 66;
const HAVE_FUTURE_DATA = 3;

/** Sends analyser frames + playback state to the playback popup window. */
export function useBroadcastPlaybackViz() {
  const { analyserRef, audioRef, current, playing } = usePlayback();
  const levelsFromHook = usePlaybackAnalyser(analyserRef, playing, 1, BAR_COUNT);
  const levelsRef = useRef<number[] | null>(null);

  useEffect(() => {
    levelsRef.current = levelsFromHook;
  }, [levelsFromHook]);

  useEffect(() => {
    if (!isTauriApp() || !current) return;

    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.ended) return;

      const loading =
        !playing && audio.readyState < HAVE_FUTURE_DATA;
      const effectiveMuted = audio.muted || audio.volume === 0;
      const scaledLevels = (levelsRef.current ?? []).map((v) =>
        effectiveMuted ? 0 : v * audio.volume,
      );

      const payload: PlaybackVizFramePayload = {
        levels: scaledLevels,
        playing,
        muted: audio.muted,
        volume: audio.volume,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        loading,
      };

      void emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.vizFrame, payload).catch(() => {
        /* okno może być ukryte */
      });
    };

    tick();
    const id = window.setInterval(tick, EMIT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [audioRef, current, playing]);
}
