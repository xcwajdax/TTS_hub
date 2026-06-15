import { useEffect, useState } from "react";
import { getCachedWaveform, setCachedWaveform } from "../lib/waveformCache";

const WAVEFORM_FETCH_RETRIES = 4;
const WAVEFORM_FETCH_RETRY_MS = 400;

function isRetryableWaveformStatus(status: number): boolean {
  return status === 404 || status === 500 || status === 503;
}

async function fetchAudioBuffer(src: string, signal: AbortSignal): Promise<ArrayBuffer> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < WAVEFORM_FETCH_RETRIES; attempt += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const res = await fetch(src, { signal });
    if (res.ok) return res.arrayBuffer();

    const err = new Error(`HTTP ${res.status}`);
    lastError = err;
    if (!isRetryableWaveformStatus(res.status) || attempt === WAVEFORM_FETCH_RETRIES - 1) {
      throw err;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, WAVEFORM_FETCH_RETRY_MS * (attempt + 1));
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }

  throw lastError ?? new Error("fetch failed");
}

export function useAudioWaveform(src: string | null, barCount = 120) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setPeaks(null);
      setDuration(null);
      setError(null);
      return;
    }

    const cacheKey = `${src}:${barCount}`;
    const cached = getCachedWaveform(cacheKey);
    if (cached) {
      setPeaks(cached.peaks);
      setDuration(cached.duration);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      setPeaks(null);
      setDuration(null);

      try {
        const buf = await fetchAudioBuffer(src, ac.signal);
        if (cancelled) return;

        const ctx = new AudioContext();
        try {
          const audio = await ctx.decodeAudioData(buf.slice(0));
          if (cancelled) return;

          const channel = audio.getChannelData(0);
          const block = Math.max(1, Math.floor(channel.length / barCount));
          const next: number[] = [];

          for (let i = 0; i < barCount; i++) {
            const start = i * block;
            let peak = 0;
            for (let j = 0; j < block && start + j < channel.length; j++) {
              peak = Math.max(peak, Math.abs(channel[start + j]));
            }
            next.push(peak);
          }

          const max = Math.max(...next, 0.001);
          const normalized = next.map((p) => p / max);
          const dur = audio.duration;
          setCachedWaveform(cacheKey, { peaks: normalized, duration: dur });
          setPeaks(normalized);
          setDuration(dur);
        } finally {
          await ctx.close();
        }
      } catch (e) {
        if (cancelled || ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [src, barCount]);

  return { peaks, duration, loading, error };
}
