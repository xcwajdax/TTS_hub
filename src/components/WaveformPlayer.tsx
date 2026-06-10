import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayback } from "../context/PlaybackContext";
import {
  TIMELINE_VIEW_CHANGE_EVENT,
  useTimelineView,
} from "../context/TimelineViewContext";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import { formatTime } from "../lib/formatTime";
import {
  formatPlaybackRateLabel,
  PLAYBACK_RATE_OPTIONS,
  type PlaybackRate,
} from "../lib/playbackPrefs";
import { timelineViewBarCount } from "../lib/timelineView";
import { drawWaveform } from "../lib/waveformCanvas";
import AudioOutputSelect from "./AudioOutputSelect";
import TimelinePanelMenu from "./TimelinePanelMenu";
import type { ArchiveFolder, ArchiveTag, Generation } from "../types";

const DEFAULT_VOLUME = 0.8;
const VOLUME_STORAGE_KEY = "tts-hub.playback.volume";
const MUTED_STORAGE_KEY = "tts-hub.playback.muted";

interface Props {
  src: string;
  className?: string;
  current?: Generation | null;
  folders?: ArchiveFolder[];
  tags?: ArchiveTag[];
  onHistoryChanged?: () => void;
  onError?: (e: string) => void;
}

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

export default function WaveformPlayer({
  src,
  className = "",
  current = null,
  folders = [],
  tags = [],
  onHistoryChanged,
  onError,
}: Props) {
  const { audioRef, playing, togglePlay, seekTo, playbackRate, setPlaybackRate } = usePlayback();
  const { mode: timelineMode } = useTimelineView();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const barCount = timelineViewBarCount(timelineMode);
  const { peaks, duration: decodedDuration, loading } = useAudioWaveform(src, barCount);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(readStoredVolume);
  const [muted, setMuted] = useState(() => window.localStorage.getItem(MUTED_STORAGE_KEY) === "true");

  const progress = duration > 0 ? currentTime / duration : 0;
  const effectiveMuted = muted || volume === 0;
  const volumePercent = Math.round(volume * 100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("durationchange", onDuration);
    onTime();
    onDuration();

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("durationchange", onDuration);
    };
  }, [audioRef, src]);

  useEffect(() => {
    if (decodedDuration != null) setDuration(decodedDuration);
  }, [decodedDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = effectiveMuted;
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    window.localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
  }, [audioRef, effectiveMuted, muted, volume]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawWaveform(ctx, w, h, peaks, progress, timelineMode);
  }, [peaks, progress, timelineMode]);

  useEffect(() => {
    const onSkin = () => draw();
    const onTimeline = () => draw();
    window.addEventListener("tts-hub-skin-change", onSkin);
    window.addEventListener(TIMELINE_VIEW_CHANGE_EVENT, onTimeline);
    return () => {
      window.removeEventListener("tts-hub-skin-change", onSkin);
      window.removeEventListener(TIMELINE_VIEW_CHANGE_EVENT, onTimeline);
    };
  }, [draw]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const seekAtClientX = (clientX: number) => {
    const audio = audioRef.current;
    const wrap = wrapRef.current;
    if (!audio || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

    const audioDuration =
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    const total = audioDuration ?? (duration > 0 ? duration : 0);
    if (total <= 0) return;

    seekTo(ratio * total);
    setCurrentTime(audio.currentTime);
  };

  const changeVolume = (nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolume(clamped);
    if (clamped > 0 && muted) setMuted(false);
  };

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(DEFAULT_VOLUME);
      setMuted(false);
      return;
    }
    setMuted((value) => !value);
  };

  return (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={togglePlay}
          disabled={loading}
          className="shrink-0 w-8 h-8 rounded-full bg-panel2 border border-border flex items-center justify-center text-sm hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          aria-label={playing ? "Pauza" : "Odtwarzaj"}
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-muted border-t-accent rounded-full animate-spin" />
          ) : playing ? (
            "❚❚"
          ) : (
            "▶"
          )}
        </button>

        <span className="text-[10px] tabular-nums text-muted shrink-0 min-w-[72px]">
          {formatTime(currentTime)}
          <span className="text-muted/60"> / </span>
          {formatTime(duration)}
        </span>

        <div
          className="flex h-8 shrink-0 items-center gap-2 px-2 rounded-lg border border-border bg-panel2 text-muted ml-auto"
          aria-label="Sterowanie glosnoscia"
        >
          <button
            type="button"
            onClick={toggleMute}
            className="w-7 h-7 rounded-md border border-border bg-panel/90 flex items-center justify-center text-xs hover:border-accent hover:text-accent transition-colors"
            aria-label={effectiveMuted ? "Wlacz dzwiek" : "Wycisz"}
            title={effectiveMuted ? "Wlacz dzwiek" : "Wycisz"}
          >
            {effectiveMuted ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => changeVolume(Number(e.currentTarget.value) / 100)}
            className="w-20 cursor-pointer [accent-color:rgb(var(--color-accent2))]"
            aria-label="Glosnosc"
            aria-valuetext={`${volumePercent}%`}
            title={`Glosnosc ${volumePercent}%`}
          />
          <span className="text-[10px] tabular-nums min-w-[34px] text-right">
            {volumePercent}%
          </span>
        </div>

        <AudioOutputSelect />

        <label className="flex h-8 shrink-0 items-center gap-1.5 px-2 rounded-lg border border-border bg-panel2 text-muted">
          <span className="text-[10px] whitespace-nowrap">Tempo</span>
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.currentTarget.value) as PlaybackRate)}
            className="text-[10px] bg-panel border border-border rounded px-1 py-0.5 text-foreground cursor-pointer hover:border-accent focus:border-accent outline-none"
            aria-label="Predkosc odtwarzania"
            title="Globalna predkosc odtwarzania"
          >
            {PLAYBACK_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {formatPlaybackRateLabel(rate)}
              </option>
            ))}
          </select>
        </label>

        {current && onHistoryChanged && onError && (
          <button
            type="button"
            className="shrink-0 w-8 h-8 rounded-lg border border-border bg-panel2 text-muted hover:border-accent hover:text-accent flex items-center justify-center text-sm"
            aria-label="Opcje generacji i wyglądu timeline"
            title="Opcje generacji i wyglądu timeline"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
            ⋮
          </button>
        )}
      </div>

      <div
        ref={wrapRef}
        className="relative w-full min-w-0 h-11 rounded-lg border border-border bg-panel2 overflow-hidden cursor-pointer group"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          seekAtClientX(e.clientX);
        }}
        role="progressbar"
        aria-label="Pozycja odtwarzania — kliknij, aby przeskoczyc; prawy przycisk: wyglad"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden />
        {timelineMode !== "line" && (
          <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/20 pointer-events-none" />
        )}
      </div>

      {contextMenu && (
        <TimelinePanelMenu
          anchorX={contextMenu.x}
          anchorY={contextMenu.y}
          current={current}
          folders={folders}
          tags={tags}
          onChanged={onHistoryChanged ?? (() => undefined)}
          onError={onError ?? (() => undefined)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
