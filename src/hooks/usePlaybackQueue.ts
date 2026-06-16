import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Generation } from "../types";
import type { SelectOptions } from "../context/PlaybackContext";
import { isGenerationPlayable } from "../lib/generationPlayback";

export interface PlayOrEnqueueResult {
  queued: boolean;
  /** Length after enqueue (0 when started immediately). */
  queueLength: number;
}

/**
 * Serializes autoplay: when audio is already playing, new generations wait in a FIFO
 * queue and start after the current track ends.
 */
export function usePlaybackQueue(
  select: (g: Generation, options?: SelectOptions) => void,
  audioRef: RefObject<HTMLAudioElement | null>,
  playing: boolean,
) {
  const queueRef = useRef<Generation[]>([]);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const clearQueue = useCallback(() => {
    queueRef.current = [];
  }, []);

  const enqueue = useCallback((g: Generation): number => {
    if (queueRef.current.some((x) => x.id === g.id)) {
      return queueRef.current.length;
    }
    queueRef.current = [...queueRef.current, g];
    return queueRef.current.length;
  }, []);

  const playOrEnqueue = useCallback(
    (g: Generation, options?: SelectOptions): PlayOrEnqueueResult => {
      if (!isGenerationPlayable(g)) {
        return { queued: false, queueLength: 0 };
      }
      if (playingRef.current) {
        const queueLength = enqueue(g);
        return { queued: true, queueLength };
      }
      select(g, options);
      return { queued: false, queueLength: 0 };
    },
    [select, enqueue],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnd = () => {
      if (queueRef.current.length === 0) return;
      const [next, ...rest] = queueRef.current;
      queueRef.current = rest;
      select(next, { loadEditorText: false });
    };

    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, [audioRef, select]);

  return { playOrEnqueue, clearQueue, queueLength: () => queueRef.current.length };
}
