import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";
import { formatModelLabel } from "../ttsModels";
import { inferGenerationProvider } from "../lib/avatars";
import {
  getSourceUi,
  sourceLabelForGeneration,
} from "../lib/historySourceUi";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import { formatGenerationMs } from "../lib/formatTime";
import { displayTitle } from "../lib/generationTitle";
import { playbackAudioSrc } from "../api/tauri";
import { isGenerationPlayable } from "../lib/generationPlayback";
import Icon from "../components/Icon";
import HistoryItemProfileAvatar from "../components/history/HistoryItemProfileAvatar";
import HistoryTextPreview from "../components/HistoryTextPreview";

interface Props {
  generation: Generation;
  voiceProfiles?: TtsVoiceProfile[];
  className?: string;
}

const AVATAR_SIZE = 56;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClockFromSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad2(s)}`;
}

/**
 * Karta podglądu wybranej generacji w studio MP4.
 * Pokazuje awatar profilu głosowego, tytuł, tekst, metadane
 * oraz mini-timeline audio (play / pause / scrub).
 *
 * Audio jest obsługiwane przez samodzielny element <audio>
 * (nie korzysta z globalnego PlaybackContext), aby nie
 * przejmować głównego odtwarzacza TTS podczas podglądu.
 */
export default function Mp4GenerationPreview({
  generation,
  voiceProfiles = [],
  className = "",
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(
    (generation.duration_ms ?? 0) / 1000,
  );
  const [expanded, setExpanded] = useState(false);

  const playable = isGenerationPlayable(generation);
  const profile = resolveProfileForGeneration(generation, voiceProfiles);
  const provider = (generation.provider ?? inferGenerationProvider(generation)) || "google";
  const sourceUi = getSourceUi(generation.source);
  const titleLabel = displayTitle(generation);
  const voiceLabel = profile?.name ?? generation.voice?.trim() ?? "Profil usunięty";
  const audioSrc = useMemo(
    () => (playable ? playbackAudioSrc(generation.id) : null),
    [playable, generation.id],
  );

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration((generation.duration_ms ?? 0) / 1000);
    setExpanded(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [generation.id, generation.duration_ms]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSrc]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    try {
      if (audio.paused || audio.ended) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (e) {
      console.warn("[mp4-preview] audio play failed:", e);
    }
  }, [audioSrc]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const next = Number(e.target.value);
      if (!Number.isFinite(next)) return;
      audio.currentTime = next;
      setCurrentTime(next);
    },
    [],
  );

  const dateLabel = useMemo(() => {
    const d = new Date(generation.created_at);
    return d.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [generation.created_at]);

  const generationTimeLabel = formatGenerationMs(generation.generation_ms);
  const inputChars = generation.input_chars;
  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <section
      className={`mp4-generation-preview flex items-stretch gap-4 border border-border rounded-lg bg-panel2/40 p-3 ${className}`.trim()}
      data-testid="mp4-generation-preview"
    >
      <div className="shrink-0">
        <HistoryItemProfileAvatar
          gen={generation}
          profile={profile}
          size={AVATAR_SIZE}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start gap-2 flex-wrap min-w-0">
          <h2
            className="text-sm font-semibold text-heading truncate flex-1 min-w-0"
            title={titleLabel}
          >
            {titleLabel}
          </h2>
          <span className="tag shrink-0" title={`Głos: ${generation.voice}`}>
            {voiceLabel}
          </span>
          <span className="tag shrink-0" title={`Provider: ${provider}`}>
            {provider}
          </span>
          <span className="tag shrink-0" title={`Model: ${generation.model}`}>
            {formatModelLabel(generation.model)}
          </span>
          <span className="tag shrink-0">{generation.format.toUpperCase()}</span>
          <span
            className="tag shrink-0"
            style={{
              backgroundColor: `color-mix(in srgb, ${sourceUi.defaultColor} 20%, transparent)`,
              color: sourceUi.defaultColor,
            }}
            title={sourceLabelForGeneration(generation)}
          >
            {sourceLabelForGeneration(generation)}
          </span>
          {generation.context_label && (
            <span className="tag shrink-0 text-accent2 border-accent/40">
              {generation.context_label}
            </span>
          )}
        </div>

        <div
          className={`mp4-generation-preview__text rounded border border-border/60 bg-black/30 p-2 text-[12px] leading-snug text-muted whitespace-pre-wrap break-words overflow-y-auto transition-[max-height] duration-200 ${
            expanded ? "max-h-72" : "max-h-28"
          }`}
          data-testid="mp4-generation-text"
        >
          <HistoryTextPreview text={generation.text} scroll={false} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {audioSrc ? (
            <button
              type="button"
              className="btn text-xs shrink-0 flex items-center gap-1.5"
              onClick={() => void togglePlay()}
              title={isPlaying ? "Pauza" : "Odtwórz"}
              data-testid="mp4-preview-play"
            >
              <Icon name={isPlaying ? "pause" : "play"} size={12} />
              {isPlaying ? "Pauza" : "Odtwórz"}
            </button>
          ) : (
            <span
              className="text-[10px] text-amber-300 shrink-0"
              title={generation.status !== "done" ? `status: ${generation.status}` : "Brak pliku audio"}
            >
              {generation.status !== "done"
                ? `(status: ${generation.status})`
                : "Brak audio"}
            </span>
          )}

          <span
            className="font-mono text-[11px] text-muted shrink-0 tabular-nums"
            data-testid="mp4-preview-time"
          >
            {formatClockFromSec(currentTime)} / {formatClockFromSec(duration)}
          </span>

          <div className="relative flex-1 min-w-[120px] flex items-center">
            <div className="absolute inset-0 h-1.5 my-auto rounded-full bg-panel2/80 overflow-hidden pointer-events-none">
              <div
                className="h-full bg-accent transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.001)}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleScrub}
              disabled={!audioSrc || duration <= 0}
              className="mp4-preview-timeline relative w-full h-3 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
              aria-label="Oś czasu podglądu audio"
              data-testid="mp4-preview-timeline"
            />
          </div>

          <span className="text-[10px] text-muted shrink-0" title={dateLabel}>
            {dateLabel}
          </span>
          {generationTimeLabel && (
            <span className="text-[10px] text-muted shrink-0" title="Czas generacji">
              · gen {generationTimeLabel}
            </span>
          )}
          {inputChars != null && (
            <span className="text-[10px] text-muted shrink-0">
              · {inputChars} zn
            </span>
          )}
          {generation.text.length > 240 && (
            <button
              type="button"
              className="text-[10px] text-accent2 hover:underline shrink-0 ml-auto"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Zwiń tekst" : "Rozwiń tekst"}
            </button>
          )}
        </div>
      </div>

      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          className="sr-only"
          data-testid="mp4-preview-audio"
        />
      )}
    </section>
  );
}
