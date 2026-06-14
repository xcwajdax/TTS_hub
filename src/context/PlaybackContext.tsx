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
import { audioSrc, playbackAudioSrc } from "../api/tauri";
import { useAudioOutputDevices } from "../hooks/useAudioOutputDevices";
import {
  applyAudioSink,
  type AudioOutputDeviceInfo,
} from "../lib/audioOutputDevice";
import {
  readStoredPlaybackRate,
  savePlaybackRate,
  type PlaybackRate,
} from "../lib/playbackPrefs";
import { openGenerationInEditor } from "../lib/editorTextLoad";
import type { Generation } from "../types";

export interface SelectOptions {
  /** When false, playback switches without loading source text into the editor. */
  loadEditorText?: boolean;
  /** When false, loads audio into timeline without starting playback. Default true. */
  autoPlay?: boolean;
}

export interface PlayClipOptions {
  path: string;
  label?: string;
}

interface PlaybackContextValue {
  current: Generation | null;
  playing: boolean;
  playNonce: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  analyserRef: RefObject<AnalyserNode | null>;
  src: string | null;
  editorText: string;
  setEditorText: (text: string) => void;
  select: (g: Generation, options?: SelectOptions) => void;
  /** One-shot clip (e.g. soundboard); pauses main TTS player. */
  playClip: (options: PlayClipOptions) => void;
  togglePlay: () => void;
  restart: () => void;
  /** Seek to position in seconds; keeps play/pause state. */
  seekTo: (seconds: number) => void;
  playbackRate: PlaybackRate;
  setPlaybackRate: (rate: PlaybackRate) => void;
  outputDeviceId: string;
  setOutputDeviceId: (deviceId: string) => void;
  audioOutputDevices: AudioOutputDeviceInfo[];
  audioOutputSupported: boolean;
  audioOutputLoading: boolean;
  refreshAudioOutputDevices: (forcePrepare?: boolean, silent?: boolean) => Promise<void>;
  canPickSystemAudioOutput: boolean;
  pickSystemAudioOutput: () => Promise<AudioOutputDeviceInfo | null>;
  audioOutputEnumerationNotice: string | null;
  lastSinkError: string | null;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

interface AudioGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
}

const AUDIO_GRAPHS_KEY = "__ttsHubAudioGraphs__";
const VOLUME_STORAGE_KEY = "tts-hub.playback.volume";
const MUTED_STORAGE_KEY = "tts-hub.playback.muted";
const DEFAULT_VOLUME = 0.8;

function readStoredVolume(): number {
  const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const value = stored == null ? DEFAULT_VOLUME : Number(stored);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

/** Survives React Strict Mode remounts and Vite HMR (module scope resets on hot reload). */
function getAudioGraphMap(): WeakMap<HTMLMediaElement, AudioGraph> {
  const g = globalThis as typeof globalThis & {
    [key: string]: WeakMap<HTMLMediaElement, AudioGraph> | undefined;
  };
  if (!g[AUDIO_GRAPHS_KEY]) {
    g[AUDIO_GRAPHS_KEY] = new WeakMap();
  }
  return g[AUDIO_GRAPHS_KEY];
}

/** One MediaElementSource per HTMLMediaElement; reuse graph when the same node is seen again. */
function ensureAudioGraph(audio: HTMLMediaElement): AudioGraph | null {
  const map = getAudioGraphMap();
  const existing = map.get(audio);
  if (existing) return existing;

  const ctx = new AudioContext();
  try {
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const graph = { ctx, analyser };
    map.set(audio, graph);
    return graph;
  } catch {
    void ctx.close();
    return null;
  }
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const skipAutoplayRef = useRef(false);
  const clipAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [current, setCurrent] = useState<Generation | null>(null);
  const [playNonce, setPlayNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(readStoredPlaybackRate);
  const [lastSinkError, setLastSinkError] = useState<string | null>(null);

  const {
    devices: audioOutputDevices,
    outputDeviceId,
    setOutputDeviceId,
    loading: audioOutputLoading,
    supported: audioOutputSupported,
    refresh: refreshAudioOutputDevices,
    canPickSystemOutput: canPickSystemAudioOutput,
    pickSystemOutput: pickSystemAudioOutput,
    enumerationNotice: audioOutputEnumerationNotice,
  } = useAudioOutputDevices();

  const src = current ? playbackAudioSrc(current.id) : null;

  const applyCurrentSink = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioOutputSupported) return;
    const result = await applyAudioSink(audio, audioContextRef.current, outputDeviceId);
    if (!result.ok) {
      setLastSinkError(result.message);
      console.warn("[playback] setSinkId failed:", result.message);
    } else {
      setLastSinkError(null);
    }
  }, [audioOutputSupported, outputDeviceId]);

  const resumeAudioContext = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== "suspended") return;
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const graph = ensureAudioGraph(audio);
    if (!graph) return;

    audioContextRef.current = graph.ctx;
    analyserRef.current = graph.analyser;
    void applyCurrentSink();
  }, [applyCurrentSink]);

  useEffect(() => {
    void applyCurrentSink();
  }, [outputDeviceId, applyCurrentSink]);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    setPlaybackRateState(rate);
    savePlaybackRate(rate);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate, src, playNonce]);

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    await applyCurrentSink();
    await resumeAudioContext();
    try {
      await audio.play();
      void refreshAudioOutputDevices();
    } catch (err) {
      console.warn("[playback] audio.play() blocked or failed:", err);
    }
  }, [applyCurrentSink, refreshAudioOutputDevices, resumeAudioContext]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const volume = readStoredVolume();
    const muted = window.localStorage.getItem(MUTED_STORAGE_KEY) === "true";
    audio.volume = volume;
    audio.muted = muted || volume === 0;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    setPlaying(false);

    if (skipAutoplayRef.current) {
      skipAutoplayRef.current = false;
      audio.load();
      return;
    }

    const start = () => void playAudio();
    audio.addEventListener("canplay", start, { once: true });
    audio.load();

    return () => audio.removeEventListener("canplay", start);
  }, [src, playNonce, playAudio]);

  const select = useCallback((g: Generation, options?: SelectOptions) => {
    if (options?.loadEditorText !== false) {
      setEditorText(g.text);
      openGenerationInEditor(g);
    }
    if (options?.autoPlay === false) {
      skipAutoplayRef.current = true;
    }
    setCurrent((prev) => {
      if (prev?.id === g.id && options?.autoPlay !== false) setPlayNonce((n) => n + 1);
      return g;
    });
  }, []);

  const playClip = useCallback(
    ({ path }: PlayClipOptions) => {
      const main = audioRef.current;
      if (main && !main.paused) {
        main.pause();
      }
      setPlaying(false);

      const clip = clipAudioRef.current;
      if (!clip) return;
      clip.src = audioSrc(path);
      clip.load();
      const start = () => {
        void clip.play().catch((err) => {
          console.warn("[playback] clip play failed:", err);
        });
      };
      clip.addEventListener("canplay", start, { once: true });
    },
    [],
  );

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
    if (audio.paused) {
      void resumeAudioContext();
      void playAudio();
    } else {
      audio.pause();
    }
  }, [playAudio, resumeAudioContext]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(seconds)) return;

      const max =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      const target = max != null ? Math.min(Math.max(0, seconds), max) : Math.max(0, seconds);
      const resume = !audio.paused && !audio.ended;

      audio.currentTime = target;
      if (resume) void playAudio();
    },
    [playAudio],
  );

  const value: PlaybackContextValue = {
    current,
    playing,
    playNonce,
    audioRef,
    analyserRef,
    src,
    editorText,
    setEditorText,
    select,
    playClip,
    togglePlay,
    restart,
    seekTo,
    playbackRate,
    setPlaybackRate,
    outputDeviceId,
    setOutputDeviceId,
    audioOutputDevices,
    audioOutputSupported,
    audioOutputLoading,
    refreshAudioOutputDevices,
    canPickSystemAudioOutput,
    pickSystemAudioOutput,
    audioOutputEnumerationNotice,
    lastSinkError,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        className="sr-only"
        crossOrigin="anonymous"
        preload="auto"
        src={src ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          console.warn("[playback] audio element failed to load:", src);
        }}
      />
      <audio ref={clipAudioRef} className="sr-only" preload="auto" />
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
