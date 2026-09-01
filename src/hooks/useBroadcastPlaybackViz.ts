import { emitTo } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { usePlaybackAnalyser } from "./usePlaybackAnalyser";
import { isTauriApp } from "../lib/tauriEnv";
import {
  PLAYBACK_TOAST_WINDOW_LABEL,
  PlaybackToastEvents,
} from "../lib/playbackToastContract";
import {
  isPlaybackPositionLockEnabled,
  savePlaybackPosition,
} from "../lib/playbackPositionLock";
import { updatePinnedProgress } from "../lib/playbackPinState";
import type { PlaybackVizFramePayload } from "../lib/playbackToastTypes";

const BAR_COUNT = 32;
const EMIT_INTERVAL_MS = 66;
const HAVE_FUTURE_DATA = 3;
const POSITION_SAVE_MS = 1000;

/** Sends analyser frames + playback state to the playback popup window. */
export function useBroadcastPlaybackViz() {
  const { analyserRef, audioRef, current, playing } = usePlayback();
  const levelsFromHook = usePlaybackAnalyser(analyserRef, playing, 1, BAR_COUNT);
  const levelsRef = useRef<number[] | null>(null);
  const lastSaveRef = useRef(0);

  useEffect(() => {
    levelsRef.current = levelsFromHook;
  }, [levelsFromHook]);

  useEffect(() => {
    if (!isTauriApp() || !current) return;

    let rafId = 0;
    let intervalId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const audio = audioRef.current;
      if (!audio) return;

      const isPlaying = !audio.paused && !audio.ended;
      const loading = !isPlaying && !audio.ended && audio.readyState < HAVE_FUTURE_DATA;
      const effectiveMuted = audio.muted || audio.volume === 0;
      const scaledLevels = (levelsRef.current ?? []).map((v) =>
        effectiveMuted ? 0 : v * audio.volume,
      );

      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const currentTime = audio.currentTime;

      const payload: PlaybackVizFramePayload = {
        levels: scaledLevels,
        playing: isPlaying,
        muted: audio.muted,
        volume: audio.volume,
        currentTime,
        duration,
        loading,
        positionLockEnabled: isPlaybackPositionLockEnabled(),
      };

      if (current && isPlaybackPositionLockEnabled()) {
        const now = Date.now();
        if (now - lastSaveRef.current >= POSITION_SAVE_MS) {
          lastSaveRef.current = now;
          savePlaybackPosition(current.id, currentTime);
        }
      }

      if (current) {
        updatePinnedProgress(current.id, currentTime, duration);
      }

      void emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.vizFrame, payload).catch(
        () => {
          /* okno może być ukryte */
        },
      );
    };

    const schedule = () => {
      if (cancelled) return;
      tick();
      if (document.hidden) {
        rafId = requestAnimationFrame(schedule);
      }
    };

    tick();
    intervalId = window.setInterval(tick, EMIT_INTERVAL_MS);
    rafId = requestAnimationFrame(schedule);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      cancelAnimationFrame(rafId);
    };
  }, [audioRef, current, playing]);
}
