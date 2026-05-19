interface CachedWaveform {
  peaks: number[];
  duration: number;
}

const cache = new Map<string, CachedWaveform>();

export function getCachedWaveform(src: string): CachedWaveform | undefined {
  return cache.get(src);
}

export function setCachedWaveform(src: string, data: CachedWaveform): void {
  cache.set(src, data);
}
