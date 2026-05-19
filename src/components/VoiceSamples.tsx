import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  audioSrc,
  ensureVoiceSample,
  generateAllVoiceSamples,
  listVoiceSamples,
  type VoiceSampleInfo,
} from "../api/tauri";
import Icon from "./Icon";

interface Props {
  model: string;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
  onError: (message: string) => void;
}

interface SampleProgress {
  voice: string;
  index: number;
  total: number;
  ready: boolean;
}

export default function VoiceSamples({ model, selectedVoice, onSelectVoice, onError }: Props) {
  const [samples, setSamples] = useState<VoiceSampleInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState<SampleProgress | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(() => {
    listVoiceSamples(model)
      .then(setSamples)
      .catch((e) => onError(String(e)));
  }, [model, onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!batching) return;
    const unlisten = listen<SampleProgress>("voice-samples:progress", (ev) => {
      setBatchProgress(ev.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [batching]);

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPlayingVoice(null);
  };

  const playVoice = async (voice: string) => {
    if (loadingVoice) return;
    setLoadingVoice(voice);
    try {
      const path = await ensureVoiceSample(model, voice);
      refresh();
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      stopAudio();
      audio.src = audioSrc(path);
      audio.onended = () => setPlayingVoice(null);
      audio.onpause = () => {
        if (audio.currentTime === 0 || audio.ended) setPlayingVoice(null);
      };
      setPlayingVoice(voice);
      await audio.play();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoadingVoice(null);
    }
  };

  const onGenerateAll = async () => {
    if (batching) return;
    setBatching(true);
    setBatchProgress(null);
    try {
      const updated = await generateAllVoiceSamples(model);
      setSamples(updated);
    } catch (e) {
      onError(String(e));
    } finally {
      setBatching(false);
      setBatchProgress(null);
    }
  };

  const readyCount = samples.filter((s) => s.ready).length;
  const total = samples.length;

  return (
    <div className="col-span-2 md:col-span-4 border-t border-border/60 pt-3 mt-1">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          className="text-xs text-muted hover:text-text transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "▼" : "▶"} Próbki głosów ({readyCount}/{total})
        </button>
        <button
          type="button"
          className="btn text-[11px] py-1"
          onClick={onGenerateAll}
          disabled={batching}
          title="Wygeneruj krótką próbkę dla każdego głosu w wybranym modelu (wymaga API)"
        >
          {batching
            ? batchProgress
              ? `Generowanie ${batchProgress.index + 1}/${batchProgress.total}: ${batchProgress.voice}…`
              : "Generowanie próbek…"
            : "Generuj wszystkie próbki"}
        </button>
        <span className="text-[10px] text-muted/80">
          Krótka fraza TTS na głos · cache lokalny per model
        </span>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {samples.map(({ voice, ready }) => {
            const selected = voice === selectedVoice;
            const loading = loadingVoice === voice;
            const playing = playingVoice === voice;
            return (
              <div
                key={voice}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-panel2/60 hover:border-border/80"
                }`}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left truncate hover:text-accent transition-colors"
                  onClick={() => onSelectVoice(voice)}
                  title={`Wybierz głos ${voice}`}
                >
                  {voice}
                </button>
                <button
                  type="button"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-panel disabled:opacity-40"
                  disabled={loading || batching}
                  onClick={() => playVoice(voice)}
                  title={ready ? `Odtwórz ${voice}` : `Wygeneruj i odtwórz ${voice}`}
                  aria-label={playing ? `Pauza ${voice}` : `Odtwórz ${voice}`}
                >
                  {loading ? (
                    <Icon name="spinner" size={14} spin />
                  ) : playing ? (
                    <Icon name="pause" size={14} />
                  ) : (
                    <Icon name="play" size={14} className={ready ? "opacity-100" : "opacity-50"} />
                  )}
                </button>
                {!ready && !batching && (
                  <span className="sr-only">brak próbki</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <audio ref={audioRef} className="sr-only" />
    </div>
  );
}
