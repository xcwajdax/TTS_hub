import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { isTauriApp } from "../lib/tauriEnv";
import {
  clearPlaybackToastDismiss,
  dismissPlaybackToastForGeneration,
} from "../lib/playbackToastState";

const VOLUME_STORAGE_KEY = "tts-hub.playback.volume";
const MUTED_STORAGE_KEY = "tts-hub.playback.muted";
const DEFAULT_VOLUME = 0.8;

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

/** Handles playback control commands from the playback popup webview. */
export function usePlaybackToastRemote() {
  const { audioRef, current, togglePlay } = usePlayback();

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const volume = readStoredVolume();
    const storedMuted = window.localStorage.getItem(MUTED_STORAGE_KEY) === "true";
    const effectiveMuted = storedMuted || volume === 0;

    if (effectiveMuted) {
      const restore = volume > 0 ? volume : DEFAULT_VOLUME;
      audio.volume = restore;
      audio.muted = false;
      window.localStorage.setItem(MUTED_STORAGE_KEY, "false");
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(restore));
    } else if (volume === 0) {
      audio.volume = DEFAULT_VOLUME;
      audio.muted = false;
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(DEFAULT_VOLUME));
      window.localStorage.setItem(MUTED_STORAGE_KEY, "false");
    } else {
      audio.muted = true;
      window.localStorage.setItem(MUTED_STORAGE_KEY, "true");
    }
  }, [audioRef]);

  const closePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    clearPlaybackToastDismiss();
  }, [audioRef]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(listen("playback-toast:toggle-play", () => togglePlay()));
    unsubs.push(listen("playback-toast:toggle-mute", () => toggleMute()));
    unsubs.push(
      listen("playback-toast:close", () => {
        closePlayback();
        void emit("playback-toast:hide");
        void invoke("hide_playback_toast");
      }),
    );
    unsubs.push(
      listen("playback-toast:user-hide", () => {
        if (current) dismissPlaybackToastForGeneration(current.id);
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [togglePlay, toggleMute, closePlayback, current]);
}
