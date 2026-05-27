import { useRef, useState } from "react";
import { audioSrc, ensureVoiceSample } from "../api/tauri";
import { usePlayback } from "../context/PlaybackContext";
import { applyAudioSink } from "../lib/audioOutputDevice";
import Icon from "./Icon";

interface Props {
  model: string;
  voice: string;
  ready?: boolean;
  onReady?: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export default function VoiceSamplePlayButton({
  model,
  voice,
  ready = false,
  onReady,
  onError,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { playbackRate, outputDeviceId, audioOutputSupported } = usePlayback();

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPlaying(false);
  };

  const onPlay = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const path = await ensureVoiceSample(model, voice);
      onReady?.();
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      stopAudio();
      audio.src = audioSrc(path);
      audio.playbackRate = playbackRate;
      if (audioOutputSupported) {
        const sink = await applyAudioSink(audio, undefined, outputDeviceId);
        if (!sink.ok) {
          console.warn("[voice-sample] setSinkId failed:", sink.message);
        }
      }
      audio.onended = () => setPlaying(false);
      audio.onpause = () => {
        if (audio.currentTime === 0 || audio.ended) setPlaying(false);
      };
      setPlaying(true);
      await audio.play();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-panel disabled:opacity-40"
        disabled={disabled || loading}
        onClick={onPlay}
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
      <audio ref={audioRef} className="sr-only" />
    </>
  );
}
