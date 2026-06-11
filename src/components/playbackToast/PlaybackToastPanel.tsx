import { useCallback, useEffect, useRef, useState } from "react";
import { formatModelLabel } from "../../ttsModels";
import { formatTime } from "../../lib/formatTime";
import {
  PLAYBACK_SNOOZE_PRESETS_MS,
  PlaybackToastEvents,
  snoozePresetLabel,
  type PlaybackToastModelPatch,
  type PlaybackToastViewModel,
  type PlaybackVizFramePayload,
} from "../../lib/playbackToastContract";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../Icon";
import ToastWindowPanel from "../toast/ToastWindowPanel";
import PlaybackToastIdentity from "./PlaybackToastIdentity";
import PlaybackSpeechAura from "./PlaybackSpeechAura";

const ICON = 16;

interface Props {
  model: PlaybackToastViewModel;
  frame: PlaybackVizFramePayload | null;
  onHide: () => void;
  onClose: () => void;
}

export default function PlaybackToastPanel({ model, frame, onHide, onClose }: Props) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [isArchived, setIsArchived] = useState(model.isArchived);
  const snoozeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsArchived(model.isArchived);
  }, [model.isArchived, model.generation.id]);

  useEffect(() => {
    if (!snoozeOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setSnoozeOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [snoozeOpen]);

  const gen = model.generation;
  const playing = frame?.playing ?? false;
  const loading = frame?.loading ?? false;
  const effectiveMuted = frame ? frame.muted || frame.volume === 0 : false;
  const volumePercent = Math.round((frame?.volume ?? 0.8) * 100);

  const timeLabel =
    frame && frame.duration > 0
      ? `${formatTime(frame.currentTime)} / ${formatTime(frame.duration)}`
      : loading
        ? "Ładowanie…"
        : null;

  const onTogglePlay = useCallback(() => {
    void emit(PlaybackToastEvents.togglePlay);
  }, []);

  const onRestart = useCallback(() => {
    void emit(PlaybackToastEvents.restart);
  }, []);

  const onToggleMute = useCallback(() => {
    void emit(PlaybackToastEvents.toggleMute);
  }, []);

  const onVolumeChange = useCallback((value: number) => {
    void emit(PlaybackToastEvents.setVolume, { volume: value });
  }, []);

  const onArchive = useCallback(() => {
    if (isArchived || archiving) return;
    setArchiving(true);
    void emit(PlaybackToastEvents.archive);
    window.setTimeout(() => setArchiving(false), 600);
  }, [archiving, isArchived]);

  const onSnooze = useCallback((delayMs: number) => {
    setSnoozeOpen(false);
    void emit(PlaybackToastEvents.snooze, { delayMs });
  }, []);

  return (
    <ToastWindowPanel
      title="Odtwarzanie"
      headerRight={
        timeLabel ? (
          <span className="text-[10px] tabular-nums text-muted shrink-0">{timeLabel}</span>
        ) : null
      }
    >
      <div className="flex gap-2.5 min-w-0">
        <PlaybackToastIdentity
          profileName={model.profileName}
          voiceAvatarPath={model.voiceAvatarPath}
          source={model.source}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate" title={gen.text}>
            {model.title}
          </p>
          <div className="text-[10px] text-muted flex flex-wrap gap-1.5 mt-0.5">
            {model.profileName && <span className="tag">{model.profileName}</span>}
            <span className="tag">{model.source.label}</span>
            <span className="tag">{formatModelLabel(gen.model)}</span>
            <span className="tag">{gen.format.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <PlaybackSpeechAura
        active={playing || loading}
        frame={frame}
        sourceColor={model.source.color}
        profileName={model.profileName}
        voiceAvatarPath={model.voiceAvatarPath}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="toast-toolbar__btn"
          onClick={onTogglePlay}
          title={playing ? "Pauza" : "Wznów"}
          aria-label={playing ? "Pauza" : "Wznów"}
        >
          <Icon name={playing ? "pause" : "play"} size={ICON} />
        </button>
        <button
          type="button"
          className="toast-toolbar__btn"
          onClick={onRestart}
          title="Od początku"
          aria-label="Odtwórz od początku"
        >
          <Icon name="reload" size={ICON} />
        </button>

        <div
          className="flex h-7 shrink-0 items-center gap-1.5 px-2 rounded-md border border-border bg-panel2 text-muted flex-1 min-w-[8rem]"
          aria-label="Sterowanie głośnością"
        >
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--icon"
            onClick={onToggleMute}
            aria-label={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
            title={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
          >
            <span className="text-xs" aria-hidden>
              {effectiveMuted ? "🔇" : volumePercent < 50 ? "🔉" : "🔊"}
            </span>
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={effectiveMuted ? 0 : volumePercent}
            onChange={(e) => onVolumeChange(Number(e.currentTarget.value) / 100)}
            className="flex-1 min-w-0 cursor-pointer [accent-color:rgb(var(--color-accent2))]"
            aria-label="Głośność"
            aria-valuetext={`${effectiveMuted ? 0 : volumePercent}%`}
          />
          <span className="text-[10px] tabular-nums min-w-[28px] text-right">
            {effectiveMuted ? 0 : volumePercent}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {!isArchived && (
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text"
            onClick={onArchive}
            disabled={archiving}
            title="Archiwizuj"
            aria-label="Archiwizuj generację"
          >
            <Icon name="archive" size={14} />
            <span>{archiving ? "…" : "Archiwizuj"}</span>
          </button>
        )}
        {isArchived && (
          <span className="text-[10px] text-muted px-1">W archiwum</span>
        )}

        <div ref={snoozeRef} className="relative">
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text"
            onClick={() => setSnoozeOpen((v) => !v)}
            aria-expanded={snoozeOpen}
            aria-haspopup="menu"
            title="Przypomnij później"
          >
            <span>Przypomnij</span>
          </button>
          {snoozeOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 mb-1 z-20 min-w-[7rem] rounded-md border border-border bg-panel shadow-lg py-1"
            >
              {PLAYBACK_SNOOZE_PRESETS_MS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-panel2 text-foreground"
                  onClick={() => onSnooze(ms)}
                >
                  Za {snoozePresetLabel(ms)}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--text ml-auto"
          onClick={onHide}
          title="Schowaj"
          aria-label="Schowaj okno"
        >
          Schowaj
        </button>
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--danger"
          onClick={onClose}
          title="Zamknij i zatrzymaj"
          aria-label="Zamknij i zatrzymaj"
        >
          <Icon name="x-circle" size={ICON} />
        </button>
      </div>
    </ToastWindowPanel>
  );
}

/** Listeners for model patch — used by PlaybackToast wrapper */
export function applyModelPatch(
  model: PlaybackToastViewModel,
  patch: PlaybackToastModelPatch,
): PlaybackToastViewModel {
  return {
    ...model,
    isArchived: patch.isArchived ?? model.isArchived,
    generation: patch.isArchived
      ? { ...model.generation, is_archived: true }
      : model.generation,
  };
}

export async function emitUserHide(): Promise<void> {
  void emit(PlaybackToastEvents.userHide);
  await invoke("hide_playback_toast");
}

export async function emitClose(): Promise<void> {
  void emit(PlaybackToastEvents.close);
  void emit(PlaybackToastEvents.hide);
  await invoke("hide_playback_toast");
}
