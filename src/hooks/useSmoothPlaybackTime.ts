import { useCallback, useEffect, useState, type RefObject } from "react";
import { usePlayback } from "../context/PlaybackContext";

interface Options {
  audioRef: RefObject<HTMLAudioElement | null>;
  src: string;
}

/** Płynna pozycja odtwarzania przez rAF; przy pauzie — timeupdate/seeked. */
export function useSmoothPlaybackTime({ audioRef, src }: Options) {
  const { playing } = usePlayback();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const setTimeImmediate = useCallback((time: number) => setCurrentTime(time), []);
  const setDurationExternal = useCallback((d: number) => {
    if (Number.isFinite(d) && d > 0) setDuration(d);
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => setCurrentTime(audio.currentTime);
    const syncDuration = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setDuration(d);
    };

    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("seeked", syncTime);
    syncDuration();

    if (!playing) {
      audio.addEventListener("timeupdate", syncTime);
      syncTime();
      return () => {
        audio.removeEventListener("loadedmetadata", syncDuration);
        audio.removeEventListener("durationchange", syncDuration);
        audio.removeEventListener("seeked", syncTime);
        audio.removeEventListener("timeupdate", syncTime);
      };
    }

    let raf = 0;
    const tick = () => {
      if (!audioRef.current) return;
      setCurrentTime(audioRef.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("seeked", syncTime);
    };
  }, [audioRef, playing, src]);

  return { currentTime, duration, setTimeImmediate, setDurationExternal };
}
