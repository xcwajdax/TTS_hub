import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import { formatTime } from "../lib/formatTime";
import { drawWaveform } from "../lib/waveformCanvas";

const DEFAULT_VOLUME = 0.8;
const VOLUME_STORAGE_KEY = "tts-hub.playback.volume";
const MUTED_STORAGE_KEY = "tts-hub.playback.muted";

interface Props {
  src: string;
  className?: string;
}

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

export default function WaveformPlayer({ src, className = "" }: Props) {
  const { audioRef, playing, togglePlay } = usePlayback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { peaks, duration: decodedDuration, loading } = useAudioWaveform(src);
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
    drawWaveform(ctx, w, h, peaks, progress);
  }, [peaks, progress]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const seek = (clientX: number) => {
    const audio = audioRef.current;
    const wrap = wrapRef.current;
    if (!audio || !wrap || !duration) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
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
    <div className={`relative flex w-full min-w-0 items-stretch gap-2 ${className}`}>
      <div
        ref={wrapRef}
        className="relative flex-1 min-w-0 h-11 rounded-lg border border-border bg-panel2 overflow-hidden cursor-pointer group"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-seek]")) return;
          seek(e.clientX);
        }}
        role="slider"
        aria-label="Pozycja odtwarzania"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/40 via-transparent to-bg/20 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2 h-full px-2">
          <button
            type="button"
            data-no-seek
            onClick={togglePlay}
            disabled={loading}
            className="shrink-0 w-8 h-8 rounded-full bg-panel/90 border border-border flex items-center justify-center text-sm hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
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

          <span className="text-[10px] tabular-nums text-muted shrink-0 min-w-[72px]" data-no-seek>
            {formatTime(currentTime)}
            <span className="text-muted/60"> / </span>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <div
        className="flex h-11 shrink-0 items-center gap-2 px-2 rounded-lg border border-border bg-panel2 text-muted"
        aria-label="Sterowanie glosnoscia"
      >
        <button
          type="button"
          onClick={toggleMute}
          className="w-8 h-8 rounded-md border border-border bg-panel/90 flex items-center justify-center text-xs hover:border-accent hover:text-accent transition-colors"
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
          className="w-20 accent-[#22d3ee] cursor-pointer"
          aria-label="Glosnosc"
          aria-valuetext={`${volumePercent}%`}
          title={`Glosnosc ${volumePercent}%`}
        />
        <span className="text-[10px] tabular-nums min-w-[34px] text-right">
          {volumePercent}%
        </span>
      </div>
    </div>
  );
}
