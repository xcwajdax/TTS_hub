import { useEffect, useRef, useState, type RefObject } from "react";

const SMOOTHING = 0.35;
const DEFAULT_BAR_COUNT = 32;

function downsampleFrequency(
  data: Uint8Array,
  barCount: number,
): number[] {
  const sliceSize = Math.max(1, Math.floor(data.length / barCount));
  const levels: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * sliceSize;
    const end = Math.min(data.length, start + sliceSize);
    let peak = 0;
    for (let j = start; j < end; j++) {
      peak = Math.max(peak, data[j]);
    }
    levels.push(peak / 255);
  }

  return levels;
}

function lerpLevels(prev: number[], next: number[]): number[] {
  if (prev.length !== next.length) return next;
  return next.map((v, i) => prev[i] + (v - prev[i]) * SMOOTHING);
}

export function usePlaybackAnalyser(
  analyserRef: RefObject<AnalyserNode | null>,
  playing: boolean,
  volumeScale: number,
  barCount = DEFAULT_BAR_COUNT,
) {
  const [levels, setLevels] = useState<number[] | null>(null);
  const smoothRef = useRef<number[]>([]);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      smoothRef.current = [];
      setLevels(null);
      return;
    }

    const tick = () => {
      const analyser = analyserRef.current;
      if (!analyser) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const binCount = analyser.frequencyBinCount;
      if (!dataRef.current || dataRef.current.length !== binCount) {
        dataRef.current = new Uint8Array(binCount);
      }

      analyser.getByteFrequencyData(dataRef.current as Uint8Array<ArrayBuffer>);
      const raw = downsampleFrequency(dataRef.current, barCount);
      const scaled = raw.map((v) => v * volumeScale);
      const smoothed = lerpLevels(smoothRef.current, scaled);
      smoothRef.current = smoothed;
      setLevels(smoothed);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [analyserRef, playing, volumeScale, barCount]);

  return levels;
}
