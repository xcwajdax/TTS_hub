import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlaybackToastEvents,
  type PlaybackToastModelPatch,
  type PlaybackToastViewModel,
  type PlaybackVizFramePayload,
} from "../lib/playbackToastContract";
import { isTauriApp } from "../lib/tauriEnv";
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
  const wasVisibleRef = useRef(false);
  const readyEmittedRef = useRef(false);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen<PlaybackToastViewModel>(PlaybackToastEvents.show, (e) => {
        setModel(e.payload);
        setVisible(true);
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
        setFrame(null);
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  useEffect(() => {
    if (!standalone || !isTauriApp() || readyEmittedRef.current) return;
    readyEmittedRef.current = true;
    void emit(PlaybackToastEvents.ready);
  }, [standalone]);

  useEffect(() => {
    if (!standalone || !isTauriApp()) return;
    if (wasVisibleRef.current && !visible) {
      const t = window.setTimeout(() => void invoke("hide_playback_toast"), 400);
      wasVisibleRef.current = false;
      return () => window.clearTimeout(t);
    }
    wasVisibleRef.current = visible;
  }, [visible, standalone]);

  const onHide = useCallback(() => {
    void emit(PlaybackToastEvents.userHide);
    setVisible(false);
    void emitUserHide();
  }, []);

  const onClose = useCallback(() => {
    void emitClose();
    setVisible(false);
  }, []);

  if (!isTauriApp() || !visible || !model) return null;

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
