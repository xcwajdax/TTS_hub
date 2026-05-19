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
  level: number;
  playNonce: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  frequencyDataRef: RefObject<Uint8Array | null>;
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelSmoothRef = useRef(0);
  const frequencyDataRef = useRef<Uint8Array>(new Uint8Array(32));

  const [current, setCurrent] = useState<Generation | null>(null);
  const [playNonce, setPlayNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);
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

  const attachAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return;

    try {
      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
        audioCtxRef.current = ctx;
      }
      void ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;

      const captureStream = (audio as HTMLAudioElement & { captureStream?: () => MediaStream })
        .captureStream;
      if (typeof captureStream === "function") {
        streamSourceRef.current?.disconnect();
        const stream = captureStream.call(audio);
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        streamSourceRef.current = source;
      } else {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
      }

      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      analyserRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    setPlaying(false);
    levelSmoothRef.current = 0;
    setLevel(0);
    frequencyDataRef.current.fill(0);
    streamSourceRef.current?.disconnect();
    streamSourceRef.current = null;
    analyserRef.current = null;

    const start = () => void playAudio();
    audio.addEventListener("canplay", start, { once: true });
    audio.load();

    return () => audio.removeEventListener("canplay", start);
  }, [src, playNonce, playAudio]);

  useEffect(() => {
    if (!current) {
      levelSmoothRef.current = 0;
      setLevel(0);
      frequencyDataRef.current.fill(0);
      return;
    }

    let raf = 0;

    const tick = () => {
      const analyser = analyserRef.current;
      const audio = audioRef.current;
      const buf = frequencyDataRef.current;
      let target = 0;

      if (analyser && audio && !audio.paused && !audio.ended) {
        analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        target = sum / (buf.length * 255);
      } else {
        buf.fill(0);
      }

      const smooth = levelSmoothRef.current * 0.78 + target * 0.22;
      levelSmoothRef.current = smooth;
      setLevel(smooth);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current?.id]);

  useEffect(() => {
    return () => {
      streamSourceRef.current?.disconnect();
      void audioCtxRef.current?.close();
    };
  }, []);

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
    level,
    playNonce,
    audioRef,
    frequencyDataRef,
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
        onPlay={() => {
          setPlaying(true);
          attachAnalyser();
        }}
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
