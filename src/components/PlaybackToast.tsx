import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import {
  MAIN_WINDOW_LABEL,
  PlaybackToastEvents,
  type GenerationToastShowPayload,
  type GenerationToastViewModel,
  type PlaybackToastModelPatch,
  type PlaybackToastMode,
  type PlaybackToastViewModel,
  type PlaybackVizFramePayload,
} from "../lib/playbackToastContract";
import { isTauriApp } from "../lib/tauriEnv";
import ToastWindowPanel from "./toast/ToastWindowPanel";
import GenerationToastPanel, { emitGenerationUserHide } from "./playbackToast/GenerationToastPanel";
import PlaybackToastPanel, {
  applyModelPatch,
  emitClose,
  emitUserHide,
} from "./playbackToast/PlaybackToastPanel";

interface Props {
  standalone?: boolean;
}

export default function PlaybackToast({ standalone = false }: Props) {
  const [mode, setMode] = useState<PlaybackToastMode | null>(null);
  const [model, setModel] = useState<PlaybackToastViewModel | null>(null);
  const [generationModel, setGenerationModel] = useState<GenerationToastViewModel | null>(null);
  const [voiceProfiles, setVoiceProfiles] = useState<TtsVoiceProfile[]>([]);
  const [frame, setFrame] = useState<PlaybackVizFramePayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [shellVisible, setShellVisible] = useState(false);
  const wasVisibleRef = useRef(false);

  const emitReady = useCallback(() => {
    void emitTo(MAIN_WINDOW_LABEL, PlaybackToastEvents.ready, {});
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;

    const toast = getCurrentWebviewWindow();
    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      toast.listen<PlaybackToastViewModel>(PlaybackToastEvents.show, (e) => {
        setMode("playback");
        setModel(e.payload);
        setGenerationModel(null);
        setVisible(true);
        setShellVisible(true);
      }),
    );

    unsubs.push(
      toast.listen<GenerationToastShowPayload>(PlaybackToastEvents.showGeneration, (e) => {
        setMode("generation");
        setGenerationModel(e.payload.model);
        setVoiceProfiles(e.payload.voiceProfiles);
        setModel(null);
        setFrame(null);
        setVisible(true);
        setShellVisible(true);
      }),
    );

    unsubs.push(
      toast.listen<PlaybackVizFramePayload>(PlaybackToastEvents.vizFrame, (e) => {
        setFrame(e.payload);
      }),
    );

    unsubs.push(
      toast.listen<PlaybackToastModelPatch>(PlaybackToastEvents.modelPatch, (e) => {
        setModel((prev) => (prev ? applyModelPatch(prev, e.payload) : prev));
      }),
    );

    unsubs.push(
      toast.listen(PlaybackToastEvents.hide, () => {
        setMode(null);
        setVisible(false);
        setShellVisible(false);
        setFrame(null);
        setGenerationModel(null);
      }),
    );

    unsubs.push(
      toast.listen(PlaybackToastEvents.ping, () => {
        setShellVisible(true);
        emitReady();
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [emitReady]);

  useEffect(() => {
    if (!standalone || !isTauriApp()) return;
    emitReady();
  }, [standalone, emitReady]);

  useEffect(() => {
    if (!standalone || !isTauriApp()) return;
    if (wasVisibleRef.current && !visible && !shellVisible) {
      const t = window.setTimeout(() => void invoke("hide_playback_toast"), 400);
      wasVisibleRef.current = false;
      return () => window.clearTimeout(t);
    }
    wasVisibleRef.current = visible || shellVisible;
  }, [visible, shellVisible, standalone]);

  const onHidePlayback = useCallback(() => {
    setVisible(false);
    setShellVisible(false);
    void emitUserHide();
  }, []);

  const onClosePlayback = useCallback(() => {
    void emitClose();
    setVisible(false);
    setShellVisible(false);
  }, []);

  const onHideGeneration = useCallback(() => {
    setVisible(false);
    setShellVisible(false);
    void emitGenerationUserHide();
  }, []);

  if (!isTauriApp()) return null;

  if (visible && mode === "generation" && generationModel) {
    return (
      <div
        className="w-full min-h-0 p-1 box-border"
        role="status"
        aria-live="polite"
        aria-label="Postęp generowania TTS"
      >
        <GenerationToastPanel
          model={generationModel}
          voiceProfiles={voiceProfiles}
          onHide={onHideGeneration}
        />
      </div>
    );
  }

  if (visible && mode === "playback" && model) {
    return (
      <div
        className="w-full min-h-0 p-1 box-border"
        role="status"
        aria-live="polite"
        aria-label="Odtwarzanie TTS"
      >
        <PlaybackToastPanel model={model} frame={frame} onHide={onHidePlayback} onClose={onClosePlayback} />
      </div>
    );
  }

  if (shellVisible) {
    return (
      <div className="w-full min-h-0 p-1 box-border" role="status" aria-live="polite">
        <ToastWindowPanel title="TTS Hub">
          <p className="text-xs text-muted py-4 text-center">Ładowanie…</p>
        </ToastWindowPanel>
      </div>
    );
  }

  return null;
}
