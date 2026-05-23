import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatModelLabel } from "../ttsModels";
import { displayTitle } from "../lib/generationTitle";
import { formatTime } from "../lib/formatTime";
import { isTauriApp } from "../lib/tauriEnv";
import type { PlaybackToastShowPayload, PlaybackVizFramePayload } from "../lib/playbackToastTypes";
import type { Generation } from "../types";
import Icon from "./Icon";
import PlaybackVizCanvas from "./PlaybackVizCanvas";

interface Props {
  standalone?: boolean;
}

const ICON = 16;

export default function PlaybackToast({ standalone = false }: Props) {
  const [gen, setGen] = useState<Generation | null>(null);
  const [frame, setFrame] = useState<PlaybackVizFramePayload | null>(null);
  const [visible, setVisible] = useState(false);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!isTauriApp()) return;

    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen<PlaybackToastShowPayload>("playback-toast:show", (e) => {
        setGen(e.payload.generation);
        setVisible(true);
      }),
    );

    unsubs.push(
      listen<PlaybackVizFramePayload>("playback-viz:frame", (e) => {
        setFrame(e.payload);
      }),
    );

    unsubs.push(
      listen("playback-toast:hide", () => {
        setVisible(false);
        setFrame(null);
        if (standalone) {
          window.setTimeout(() => void invoke("hide_playback_toast"), 400);
        }
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
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

  const onTogglePlay = useCallback(() => {
    void emit("playback-toast:toggle-play");
  }, []);

  const onToggleMute = useCallback(() => {
    void emit("playback-toast:toggle-mute");
  }, []);

  const onHide = useCallback(() => {
    void emit("playback-toast:user-hide");
    setVisible(false);
    void invoke("hide_playback_toast");
  }, []);

  const onClose = useCallback(() => {
    void emit("playback-toast:close");
    void emit("playback-toast:hide");
    void invoke("hide_playback_toast");
  }, []);

  if (!isTauriApp() || !visible || !gen) return null;

  const title = displayTitle(gen);
  const playing = frame?.playing ?? false;
  const loading = frame?.loading ?? false;
  const effectiveMuted = frame ? frame.muted || frame.volume === 0 : false;
  const timeLabel =
    frame && frame.duration > 0
      ? `${formatTime(frame.currentTime)} / ${formatTime(frame.duration)}`
      : loading
        ? "Ładowanie…"
        : null;

  return (
    <div
      className="w-full min-h-0 p-1 box-border"
      role="status"
      aria-live="polite"
      aria-label="Odtwarzanie TTS"
    >
      <div className="w-full flex flex-col gap-2 pointer-events-auto">
        <div className="rounded-lg border border-border/80 bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur-md overflow-hidden">
          <header className="px-2.5 py-1.5 border-b border-border/60 bg-panel2/80 flex items-center justify-between gap-2">
            <h3 className="text-[10px] uppercase tracking-wide text-muted font-medium">Odtwarzanie</h3>
            {timeLabel && (
              <span className="text-[10px] tabular-nums text-muted shrink-0">{timeLabel}</span>
            )}
          </header>
          <div className="p-2.5 flex flex-col gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" title={gen.text}>
                {title}
              </p>
              <div className="text-[10px] text-muted flex flex-wrap gap-1.5 mt-1">
                <span className="tag">{formatModelLabel(gen.model)}</span>
                <span className="tag">{gen.voice}</span>
                <span className="tag">{gen.format.toUpperCase()}</span>
              </div>
            </div>
            <PlaybackVizCanvas
              active={playing || loading}
              levels={frame?.levels ?? null}
              compact
            />
            <div className="playback-toast-toolbar flex items-center justify-center gap-1.5 pt-0.5">
              <button
                type="button"
                className="playback-toast-toolbar__btn"
                onClick={onTogglePlay}
                title={playing ? "Pauza" : "Wznów"}
                aria-label={playing ? "Pauza" : "Wznów"}
              >
                <Icon name={playing ? "pause" : "play"} size={ICON} />
              </button>
              <button
                type="button"
                className="playback-toast-toolbar__btn"
                onClick={onToggleMute}
                title={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
                aria-label={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
              >
                <span className="text-xs" aria-hidden>
                  {effectiveMuted ? "🔇" : "🔊"}
                </span>
              </button>
              <button
                type="button"
                className="playback-toast-toolbar__btn"
                onClick={onHide}
                title="Schowaj"
                aria-label="Schowaj okno"
              >
                <span className="text-[10px] font-medium">Schowaj</span>
              </button>
              <button
                type="button"
                className="playback-toast-toolbar__btn playback-toast-toolbar__btn--danger"
                onClick={onClose}
                title="Zamknij i zatrzymaj"
                aria-label="Zamknij i zatrzymaj"
              >
                <Icon name="x-circle" size={ICON} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
