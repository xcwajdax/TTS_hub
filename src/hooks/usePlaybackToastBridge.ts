import { emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef } from "react";
import { archiveGeneration, cancelJob, getAppSettings } from "../api/tauri";
import { loadSaveFormat } from "../audioFormats";
import type { TtsVoiceProfile } from "../appSettings";
import { useJobs } from "../context/JobsContext";
import { usePlayback } from "../context/PlaybackContext";
import { buildGenerationToastModel } from "../lib/buildGenerationToastModel";
import { buildPlaybackToastModel } from "../lib/buildPlaybackToastModel";
import { isGenerationPlayable } from "../lib/generationPlayback";
import {
  isMainInBackground,
  isPlaybackToastActive,
} from "../lib/playbackToastActive";
import {
  MAIN_WINDOW_LABEL,
  PLAYBACK_TOAST_WINDOW_LABEL,
  PlaybackToastEvents,
  type GenerationToastViewModel,
  type PlaybackToastCancelJobPayload,
  type PlaybackToastMode,
  type PlaybackToastModelPatch,
  type PlaybackToastSetVolumePayload,
  type PlaybackToastSnoozePayload,
  type PlaybackToastViewModel,
} from "../lib/playbackToastContract";
import {
  clearDismissOnPlaybackStart,
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
const FOCUS_POLL_MS = 350;
const MODEL_DELIVERY_ATTEMPTS = 40;
const MODEL_DELIVERY_DELAY_MS = 50;

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface Options {
  onHistoryChanged?: () => void;
  onReminder?: (title: string) => void;
}

export function usePlaybackToastBridge({ onHistoryChanged, onReminder }: Options = {}) {
  const { audioRef, current, playing, togglePlay, restart, select } = usePlayback();
  const { activeJobs, jobs } = useJobs();
  const toastVisibleRef = useRef(false);
  const toastModeRef = useRef<PlaybackToastMode | null>(null);
  const generationToastSuppressedRef = useRef(false);
  const toastReadyRef = useRef(false);
  const lastModelRef = useRef<PlaybackToastViewModel | null>(null);
  const lastGenerationModelRef = useRef<GenerationToastViewModel | null>(null);
  const profilesRef = useRef<TtsVoiceProfile[]>([]);
  const syncInFlightRef = useRef(false);
  const showInFlightRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);
  const playingRef = useRef(playing);

  const { scheduleSnooze } = usePlaybackSnooze(select, onReminder);

  playingRef.current = playing;

  useEffect(() => {
    currentIdRef.current = current?.id ?? null;
  }, [current?.id]);

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

  const hideToast = useCallback(async () => {
    toastVisibleRef.current = false;
    toastModeRef.current = null;
    await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.hide, {}).catch(() => {});
    await invoke("hide_playback_toast");
  }, []);

  const deliverModelToToast = useCallback(async (model: PlaybackToastViewModel) => {
    lastModelRef.current = model;
    for (let attempt = 0; attempt < MODEL_DELIVERY_ATTEMPTS; attempt++) {
      try {
        await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.show, model);
        toastModeRef.current = "playback";
        return true;
      } catch {
        await sleep(MODEL_DELIVERY_DELAY_MS);
      }
    }
    console.warn("[playback-toast] failed to deliver model to toast window");
    return false;
  }, []);

  const deliverGenerationToToast = useCallback(async (model: GenerationToastViewModel) => {
    lastGenerationModelRef.current = model;
    for (let attempt = 0; attempt < MODEL_DELIVERY_ATTEMPTS; attempt++) {
      try {
        await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.showGeneration, {
          model,
          voiceProfiles: profilesRef.current,
        });
        toastModeRef.current = "generation";
        return true;
      } catch {
        await sleep(MODEL_DELIVERY_DELAY_MS);
      }
    }
    console.warn("[playback-toast] failed to deliver generation model to toast window");
    return false;
  }, []);

  const generationModelSignature = (model: GenerationToastViewModel): string =>
    model.jobs
      .map(
        (j) =>
          `${j.id}:${j.status}:${j.phase}:${Math.round(j.elapsedMs / 200)}:${j.queueTotal}`,
      )
      .join("|");

  const syncPlaybackToast = useCallback(async () => {
    if (!isTauriApp() || syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const pendingJobs = activeJobs.filter(
        (j) => j.status === "queued" || j.status === "running",
      );
      if (pendingJobs.length === 0) {
        generationToastSuppressedRef.current = false;
      }

      const audio = audioRef.current;
      const genId = currentIdRef.current;
      const isPlaying = playingRef.current;
      const generation =
        current ??
        (lastModelRef.current?.generation.id === genId ? lastModelRef.current.generation : null);
      const currentJob = generation ? jobs[generation.id] : undefined;
      const currentStillGenerating = Boolean(
        currentJob && (currentJob.status === "queued" || currentJob.status === "running"),
      );
      const playbackEligible =
        generation != null &&
        isGenerationPlayable(generation) &&
        !currentStillGenerating &&
        isPlaybackToastActive(genId, audio, isPlaying);

      const main = await WebviewWindow.getByLabel(MAIN_WINDOW_LABEL);
      if (!main) return;

      const focused = await main.isFocused();
      const visible = await main.isVisible();
      const minimized = await main.isMinimized();
      const inBackground = isMainInBackground(focused, minimized, visible);

      if (!inBackground) {
        if (!showInFlightRef.current && toastVisibleRef.current) {
          await hideToast();
        } else if (!toastVisibleRef.current) {
          await invoke("hide_playback_toast").catch(() => {});
        }
        return;
      }

      if (currentStillGenerating && pendingJobs.length > 0) {
        if (generationToastSuppressedRef.current) {
          if (toastVisibleRef.current) await hideToast();
          return;
        }

        const genModel = buildGenerationToastModel(activeJobs);
        if (genModel.jobs.length === 0) {
          if (toastVisibleRef.current) await hideToast();
          return;
        }

        const signature = generationModelSignature(genModel);
        const lastSignature = lastGenerationModelRef.current
          ? generationModelSignature(lastGenerationModelRef.current)
          : null;

        if (
          toastVisibleRef.current &&
          toastModeRef.current === "generation" &&
          signature === lastSignature
        ) {
          return;
        }

        if (showInFlightRef.current) return;
        showInFlightRef.current = true;
        try {
          await invoke("hide_quick_hotkey_toast");
          await invoke("show_playback_toast");
          await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.ping, {}).catch(() => {});
          await deliverGenerationToToast(genModel);
          toastVisibleRef.current = true;
        } finally {
          showInFlightRef.current = false;
        }
        return;
      }

      if (!playbackEligible || !generation) {
        if (!showInFlightRef.current) {
          if (toastVisibleRef.current) {
            await hideToast();
          } else {
            await invoke("hide_playback_toast").catch(() => {});
          }
        }
        return;
      }

      if (isPlaybackToastDismissed(generation.id)) {
        if (toastVisibleRef.current) await hideToast();
        return;
      }

      if (showInFlightRef.current) return;

      if (
        toastVisibleRef.current &&
        toastModeRef.current === "playback" &&
        lastModelRef.current?.generation.id === generation.id
      ) {
        return;
      }

      showInFlightRef.current = true;
      try {
        await invoke("hide_quick_hotkey_toast");
        await invoke("show_playback_toast");
        await emitTo(PLAYBACK_TOAST_WINDOW_LABEL, PlaybackToastEvents.ping, {}).catch(() => {});

        const model = await buildPlaybackToastModel(generation, profilesRef.current);
        await deliverModelToToast(model);
        toastVisibleRef.current = true;
      } finally {
        showInFlightRef.current = false;
      }
    } catch (e) {
      console.warn("[playback-toast] show/hide failed:", e);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [
    activeJobs,
    audioRef,
    current,
    deliverGenerationToToast,
    deliverModelToToast,
    hideToast,
    jobs,
  ]);

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
  }, [audioRef]);

  useEffect(() => {
    resetDismissIfNewGeneration(current?.id);
  }, [current?.id]);

  useEffect(() => {
    if (!playing) return;
    clearDismissOnPlaybackStart(current?.id);
  }, [playing, current?.id]);

  useEffect(() => {
    if (!isTauriApp()) return;
    void syncPlaybackToast();
  }, [current, playing, activeJobs, syncPlaybackToast]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const audio = audioRef.current;
    if (!audio) return;

    const onPlaybackChange = () => void syncPlaybackToast();
    audio.addEventListener("ended", onPlaybackChange);
    audio.addEventListener("pause", onPlaybackChange);
    audio.addEventListener("play", onPlaybackChange);
    return () => {
      audio.removeEventListener("ended", onPlaybackChange);
      audio.removeEventListener("pause", onPlaybackChange);
      audio.removeEventListener("play", onPlaybackChange);
    };
  }, [audioRef, current, syncPlaybackToast]);

  useEffect(() => {
    if (!isTauriApp()) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (!currentIdRef.current && !toastVisibleRef.current && activeJobs.length === 0) return;
      void syncPlaybackToast();
    };

    const pollId = window.setInterval(tick, FOCUS_POLL_MS);

    let unlistenBlur: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    void WebviewWindow.getByLabel(MAIN_WINDOW_LABEL)
      .then(async (main) => {
        if (!main || cancelled) return;
        unlistenBlur = await main.listen("tauri://blur", tick);
        unlistenFocus = await main.listen("tauri://focus", tick);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      unlistenBlur?.();
      unlistenFocus?.();
    };
  }, [syncPlaybackToast, activeJobs.length]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const main = getCurrentWebviewWindow();
    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      main.listen(PlaybackToastEvents.ready, async () => {
        toastReadyRef.current = true;
        if (toastModeRef.current === "generation" && lastGenerationModelRef.current) {
          await deliverGenerationToToast(lastGenerationModelRef.current);
          return;
        }
        if (lastModelRef.current) {
          await deliverModelToToast(lastModelRef.current);
        }
      }),
    );

    unsubs.push(main.listen(PlaybackToastEvents.togglePlay, () => togglePlay()));
    unsubs.push(main.listen(PlaybackToastEvents.restart, () => restart()));
    unsubs.push(
      main.listen<PlaybackToastSetVolumePayload>(PlaybackToastEvents.setVolume, (e) => {
        setVolume(e.payload.volume);
      }),
    );
    unsubs.push(main.listen(PlaybackToastEvents.toggleMute, () => toggleMute()));

    unsubs.push(
      main.listen(PlaybackToastEvents.archive, async () => {
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
      main.listen<PlaybackToastSnoozePayload>(PlaybackToastEvents.snooze, async (e) => {
        if (!current || !lastModelRef.current) return;
        const audio = audioRef.current;
        if (audio) audio.pause();
        scheduleSnooze(current, e.payload.delayMs, lastModelRef.current.title);
        await hideToast();
      }),
    );

    unsubs.push(
      main.listen(PlaybackToastEvents.close, async () => {
        toastVisibleRef.current = false;
        if (current) dismissPlaybackToastForGeneration(current.id, true);
        closePlayback();
        await hideToast();
      }),
    );

    unsubs.push(
      main.listen(PlaybackToastEvents.userHide, async () => {
        if (toastModeRef.current === "generation") {
          generationToastSuppressedRef.current = true;
        } else if (current) {
          dismissPlaybackToastForGeneration(current.id);
        }
        await hideToast();
      }),
    );

    unsubs.push(
      main.listen<PlaybackToastCancelJobPayload>(PlaybackToastEvents.cancelJob, async (e) => {
        try {
          await cancelJob(e.payload.jobId);
        } catch (err) {
          console.warn("[playback-toast] cancel job failed:", err);
        }
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
    deliverModelToToast,
    deliverGenerationToToast,
  ]);
}
