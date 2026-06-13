import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAIN_WINDOW_LABEL,
  PlaybackToastEvents,
  type PlaybackToastModelPatch,
  type PlaybackToastViewModel,
  type PlaybackVizFramePayload,
} from "../lib/playbackToastContract";
import { isTauriApp } from "../lib/tauriEnv";
import ToastWindowPanel from "./toast/ToastWindowPanel";
import PlaybackToastPanel, {
  applyModelPatch,
  emitClose,
  emitUserHide,
} from "./playbackToast/PlaybackToastPanel";

interface Props {
  standalone?: boolean;
}

export default function PlaybackToast({ standalone = false }: Props) {
  const [model, setModel] = useState<PlaybackToastViewModel | null>(null);
  const [frame, setFrame] = useState<PlaybackVizFramePayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [shellVisible, setShellVisible] = useState(false);
  const wasVisibleRef = useRef(false);

  const emitReady = useCallback(() => {
    void emitTo(MAIN_WINDOW_LABEL, PlaybackToastEvents.ready, {});
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen<PlaybackToastViewModel>(PlaybackToastEvents.show, (e) => {
        setModel(e.payload);
        setVisible(true);
        setShellVisible(true);
      }),
    );

    unsubs.push(
      listen<PlaybackVizFramePayload>(PlaybackToastEvents.vizFrame, (e) => {
        setFrame(e.payload);
      }),
    );

    unsubs.push(
      listen<PlaybackToastModelPatch>(PlaybackToastEvents.modelPatch, (e) => {
        setModel((prev) => (prev ? applyModelPatch(prev, e.payload) : prev));
      }),
    );

    unsubs.push(
      listen(PlaybackToastEvents.hide, () => {
        setVisible(false);
        setShellVisible(false);
        setFrame(null);
      }),
    );

    unsubs.push(
      listen(PlaybackToastEvents.ping, () => {
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

  const onHide = useCallback(() => {
    setVisible(false);
    setShellVisible(false);
    void emitUserHide();
  }, []);

  const onClose = useCallback(() => {
    void emitClose();
    setVisible(false);
    setShellVisible(false);
  }, []);

  if (!isTauriApp()) return null;

  if (visible && model) {
    return (
      <div
        className="w-full min-h-0 p-1 box-border"
        role="status"
        aria-live="polite"
        aria-label="Odtwarzanie TTS"
      >
        <PlaybackToastPanel model={model} frame={frame} onHide={onHide} onClose={onClose} />
      </div>
    );
  }

  if (shellVisible) {
    return (
      <div className="w-full min-h-0 p-1 box-border" role="status" aria-live="polite">
        <ToastWindowPanel title="Odtwarzanie">
          <p className="text-xs text-muted py-4 text-center">Ładowanie…</p>
        </ToastWindowPanel>
      </div>
    );
  }

  return null;
}
