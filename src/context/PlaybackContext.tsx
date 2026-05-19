import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { playbackAudioSrc } from "../api/tauri";
import type { Generation } from "../types";

interface PlaybackContextValue {
  current: Generation | null;
  playing: boolean;
  playNonce: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  src: string | null;
  editorText: string;
  setEditorText: (text: string) => void;
  select: (g: Generation) => void;
  togglePlay: () => void;
  restart: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [current, setCurrent] = useState<Generation | null>(null);
  const [playNonce, setPlayNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editorText, setEditorText] = useState("");

  const src = current ? playbackAudioSrc(current.id) : null;

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
    } catch {
      // blocked until user gesture
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    setPlaying(false);

    const start = () => void playAudio();
    audio.addEventListener("canplay", start, { once: true });
    audio.load();

    return () => audio.removeEventListener("canplay", start);
  }, [src, playNonce, playAudio]);

  const select = useCallback((g: Generation) => {
    setEditorText(g.text);
    setCurrent((prev) => {
      if (prev?.id === g.id) setPlayNonce((n) => n + 1);
      return g;
    });
  }, []);

  const restart = useCallback(() => {
    setPlayNonce((n) => n + 1);
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void playAudio();
  }, [playAudio]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void playAudio();
    else audio.pause();
  }, [playAudio]);

  const value: PlaybackContextValue = {
    current,
    playing,
    playNonce,
    audioRef,
    src,
    editorText,
    setEditorText,
    select,
    togglePlay,
    restart,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        className="sr-only"
        preload="auto"
        src={src ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
