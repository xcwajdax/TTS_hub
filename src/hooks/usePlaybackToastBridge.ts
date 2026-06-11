import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef } from "react";
import { archiveGeneration, getAppSettings } from "../api/tauri";
import { loadSaveFormat } from "../audioFormats";
import type { TtsVoiceProfile } from "../appSettings";
import { usePlayback } from "../context/PlaybackContext";
import { buildPlaybackToastModel } from "../lib/buildPlaybackToastModel";
import {
  PLAYBACK_TOAST_WINDOW_LABEL,
  PlaybackToastEvents,
  type PlaybackToastModelPatch,
  type PlaybackToastSetVolumePayload,
  type PlaybackToastSnoozePayload,
  type PlaybackToastViewModel,
} from "../lib/playbackToastContract";
import {
  clearPlaybackToastDismiss,
  dismissPlaybackToastForGeneration,
  isPlaybackToastDismissed,
  resetDismissIfNewGeneration,
} from "../lib/playbackToastState";
import { isTauriApp } from "../lib/tauriEnv";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { usePlaybackSnooze } from "./usePlaybackSnooze";

const VOLUME_STORAGE_KEY = "tts-hub.playback.volume";
const MUTED_STORAGE_KEY = "tts-hub.playback.muted";
const DEFAULT_VOLUME = 0.8;

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

interface Options {
  onHistoryChanged?: () => void;
  onReminder?: (title: string) => void;
}

export function usePlaybackToastBridge({ onHistoryChanged, onReminder }: Options = {}) {
  const { audioRef, current, playing, togglePlay, restart, select } = usePlayback();
  const wasActiveRef = useRef(false);
  const toastReadyRef = useRef(false);
  const lastModelRef = useRef<PlaybackToastViewModel | null>(null);
  const profilesRef = useRef<TtsVoiceProfile[]>([]);

  const { scheduleSnooze } = usePlaybackSnooze(select, onReminder);

  const refreshProfiles = useCallback(() => {
    void getAppSettings()
      .then((view) => {
        profilesRef.current = view.voice_profiles ?? [];
      })
      .catch(() => {
        profilesRef.current = [];
      });
  }, []);

  useEffect(() => {
    refreshProfiles();
    window.addEventListener(VOICE_PROFILES_CHANGED, refreshProfiles);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refreshProfiles);
  }, [refreshProfiles]);

  const pushModelToToast = useCallback(async (model: PlaybackToastViewModel) => {
    lastModelRef.current = model;
    if (!toastReadyRef.current) return;
    await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.show, model).catch(() => {});
  }, []);

  const hideToast = useCallback(async () => {
    await emit(PlaybackToastEvents.hide);
    await invoke("hide_playback_toast");
  }, []);

  const setVolume = useCallback(
    (volume: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clamped = Math.min(1, Math.max(0, volume));
      audio.volume = clamped;
      if (clamped > 0) audio.muted = false;
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      if (clamped > 0) window.localStorage.setItem(MUTED_STORAGE_KEY, "false");
    },
    [audioRef],
  );

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
    resetDismissIfNewGeneration(current?.id);
  }, [current?.id]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const sync = async () => {
      const audio = audioRef.current;
      const active = !!current && !!audio && !audio.ended;

      if (!active) {
        if (wasActiveRef.current) await hideToast();
        wasActiveRef.current = false;
        return;
      }

      if (current && isPlaybackToastDismissed(current.id)) {
        await hideToast();
        wasActiveRef.current = true;
        return;
      }

      try {
        const main = await WebviewWindow.getByLabel("main");
        if (!main) return;
        const focused = await main.isFocused();
        const visible = await main.isVisible();
        const minimized = await main.isMinimized();

        if (focused && visible && !minimized) {
          await hideToast();
          wasActiveRef.current = true;
          return;
        }

        await invoke("hide_quick_hotkey_toast");
        await invoke("show_playback_toast");

        const model = await buildPlaybackToastModel(current, profilesRef.current);
        await pushModelToToast(model);

        wasActiveRef.current = true;
      } catch (e) {
        console.warn("[playback-toast] show/hide failed:", e);
      }
    };

    void sync();

    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => void sync();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [audioRef, current, playing, hideToast, pushModelToToast]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen(PlaybackToastEvents.ready, async () => {
        toastReadyRef.current = true;
        if (lastModelRef.current) {
          await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.show, lastModelRef.current);
        }
      }),
    );

    unsubs.push(listen(PlaybackToastEvents.togglePlay, () => togglePlay()));
    unsubs.push(listen(PlaybackToastEvents.restart, () => restart()));
    unsubs.push(
      listen<PlaybackToastSetVolumePayload>(PlaybackToastEvents.setVolume, (e) => {
        setVolume(e.payload.volume);
      }),
    );
    unsubs.push(listen(PlaybackToastEvents.toggleMute, () => toggleMute()));

    unsubs.push(
      listen(PlaybackToastEvents.archive, async () => {
        if (!current || current.is_archived) return;
        try {
          const updated = await archiveGeneration(current.id, loadSaveFormat());
          onHistoryChanged?.();
          const patch: PlaybackToastModelPatch = { isArchived: true };
          await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.modelPatch, patch);
          if (lastModelRef.current?.generation.id === updated.id) {
            lastModelRef.current = {
              ...lastModelRef.current,
              generation: updated,
              isArchived: true,
            };
          }
        } catch (e) {
          console.warn("[playback-toast] archive failed:", e);
        }
      }),
    );

    unsubs.push(
      listen<PlaybackToastSnoozePayload>(PlaybackToastEvents.snooze, async (e) => {
        if (!current || !lastModelRef.current) return;
        const audio = audioRef.current;
        if (audio) audio.pause();
        scheduleSnooze(current, e.payload.delayMs, lastModelRef.current.title);
        await hideToast();
      }),
    );

    unsubs.push(
      listen(PlaybackToastEvents.close, async () => {
        closePlayback();
        await hideToast();
      }),
    );

    unsubs.push(
      listen(PlaybackToastEvents.userHide, () => {
        if (current) dismissPlaybackToastForGeneration(current.id);
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [
    togglePlay,
    restart,
    setVolume,
    toggleMute,
    closePlayback,
    current,
    hideToast,
    scheduleSnooze,
    onHistoryChanged,
    audioRef,
  ]);

}
