import { useCallback, useEffect, useRef, useState } from "react";
import { emit, emitTo } from "@tauri-apps/api/event";
import { formatModelLabel } from "../../ttsModels";
import { formatTime } from "../../lib/formatTime";
import {
  MAIN_WINDOW_LABEL,
  PLAYBACK_SNOOZE_PRESETS_MS,
  PlaybackToastEvents,
  snoozePresetLabel,
  type PlaybackToastModelPatch,
  type PlaybackToastViewModel,
  type PlaybackVizFramePayload,
} from "../../lib/playbackToastContract";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../Icon";
import ToastWindowPanel from "../toast/ToastWindowPanel";
import PlaybackToastIdentity from "./PlaybackToastIdentity";
import PlaybackSpeechAura from "./PlaybackSpeechAura";

const ICON = 14;
const AVATAR_SIZE = 28;

interface Props {
  model: PlaybackToastViewModel;
  frame: PlaybackVizFramePayload | null;
  onHide: () => void;
  onClose: () => void;
}

function emitMain<T>(event: string, payload?: T): void {
  void emitTo(MAIN_WINDOW_LABEL, event, payload ?? {});
}

export default function PlaybackToastPanel({ model, frame, onHide, onClose }: Props) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [isArchived, setIsArchived] = useState(model.isArchived);
  const [playOverride, setPlayOverride] = useState<boolean | null>(null);
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
  const framePlaying = frame?.playing ?? false;
  const playing = playOverride ?? framePlaying;
  const loading = frame?.loading ?? false;
  const effectiveMuted = frame ? frame.muted || frame.volume === 0 : false;
  const volumePercent = Math.round((frame?.volume ?? 0.8) * 100);

  useEffect(() => {
    if (playOverride === null || !frame) return;
    if (frame.playing === playOverride) setPlayOverride(null);
  }, [frame, frame?.playing, playOverride]);

  const timeLabel =
    frame && frame.duration > 0
      ? `${formatTime(frame.currentTime)} / ${formatTime(frame.duration)}`
      : loading
        ? "Ładowanie…"
        : null;

  const onTogglePlay = useCallback(() => {
    setPlayOverride(!(playOverride ?? framePlaying));
    emitMain(PlaybackToastEvents.togglePlay);
  }, [framePlaying, playOverride]);

  const onRestart = useCallback(() => {
    setPlayOverride(true);
    emitMain(PlaybackToastEvents.restart);
  }, []);

  const onToggleMute = useCallback(() => {
    emitMain(PlaybackToastEvents.toggleMute);
  }, []);

  const onVolumeChange = useCallback((value: number) => {
    emitMain(PlaybackToastEvents.setVolume, { volume: value });
  }, []);

  const onArchive = useCallback(() => {
    if (isArchived || archiving) return;
    setArchiving(true);
    emitMain(PlaybackToastEvents.archive);
    window.setTimeout(() => setArchiving(false), 600);
  }, [archiving, isArchived]);

  const onSnooze = useCallback((delayMs: number) => {
    setSnoozeOpen(false);
    emitMain(PlaybackToastEvents.snooze, { delayMs });
  }, []);

  return (
    <ToastWindowPanel
      compact
      title="Odtwarzanie"
      headerRight={
        timeLabel ? (
          <span className="text-[9px] tabular-nums text-muted shrink-0">{timeLabel}</span>
        ) : null
      }
    >
      <div className="flex gap-2 min-w-0 items-center">
        <PlaybackToastIdentity
          profileName={model.profileName}
          voiceAvatarPath={model.voiceAvatarPath}
          provider={model.provider}
          source={model.source}
          size={AVATAR_SIZE}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate" title={gen.text}>
            {model.title}
          </p>
          <div className="text-[9px] text-muted/90 flex flex-wrap gap-1 mt-0.5 leading-tight">
            {model.profileName && <span>{model.profileName}</span>}
            {model.profileName && <span className="text-muted/50">·</span>}
            <span>{model.source.label}</span>
            <span className="text-muted/50">·</span>
            <span>{formatModelLabel(gen.model)}</span>
            <span className="text-muted/50">·</span>
            <span>{gen.format.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <PlaybackSpeechAura
        active={playing || loading}
        frame={frame}
        sourceColor={model.source.color}
      />

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--icon"
          onClick={onTogglePlay}
          title={playing ? "Pauza" : "Wznów"}
          aria-label={playing ? "Pauza" : "Wznów"}
        >
          <Icon name={playing ? "pause" : "play"} size={ICON} />
        </button>
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--icon"
          onClick={onRestart}
          title="Od początku"
          aria-label="Odtwórz od początku"
        >
          <Icon name="reload" size={ICON} />
        </button>

        <div
          className="flex h-6 shrink-0 items-center gap-1 px-1.5 rounded-md border border-border bg-panel2 text-muted flex-1 min-w-[7rem]"
          aria-label="Sterowanie głośnością"
        >
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--icon toast-toolbar__btn--bare"
            onClick={onToggleMute}
            aria-label={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
            title={effectiveMuted ? "Włącz dźwięk" : "Wycisz"}
          >
            <span className="text-[10px]" aria-hidden>
              {effectiveMuted ? "🔇" : volumePercent < 50 ? "🔉" : "🔊"}
            </span>
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={effectiveMuted ? 0 : volumePercent}
            onChange={(e) => onVolumeChange(Number(e.currentTarget.value) / 100)}
            className="flex-1 min-w-0 h-3 cursor-pointer [accent-color:rgb(var(--color-accent2))]"
            aria-label="Głośność"
            aria-valuetext={`${effectiveMuted ? 0 : volumePercent}%`}
          />
          <span className="text-[9px] tabular-nums min-w-[24px] text-right">
            {effectiveMuted ? 0 : volumePercent}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {!isArchived && (
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm"
            onClick={onArchive}
            disabled={archiving}
            title="Archiwizuj"
            aria-label="Archiwizuj generację"
          >
            <Icon name="archive" size={12} />
            <span>{archiving ? "…" : "Archiwizuj"}</span>
          </button>
        )}
        {isArchived && <span className="text-[9px] text-muted px-1">W archiwum</span>}

        <div ref={snoozeRef} className="relative">
          <button
            type="button"
            className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm"
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
              className="absolute bottom-full left-0 mb-1 z-20 min-w-[6.5rem] rounded-md border border-border bg-panel shadow-lg py-0.5"
            >
              {PLAYBACK_SNOOZE_PRESETS_MS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-2 py-1 text-[10px] hover:bg-panel2 text-foreground"
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
          className="toast-toolbar__btn toast-toolbar__btn--text toast-toolbar__btn--sm ml-auto"
          onClick={onHide}
          title="Schowaj"
          aria-label="Schowaj okno"
        >
          Schowaj
        </button>
        <button
          type="button"
          className="toast-toolbar__btn toast-toolbar__btn--icon toast-toolbar__btn--danger"
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
  emitMain(PlaybackToastEvents.userHide);
  await invoke("hide_playback_toast");
}

export async function emitClose(): Promise<void> {
  emitMain(PlaybackToastEvents.close);
  void emit(PlaybackToastEvents.hide);
  await invoke("hide_playback_toast");
}
