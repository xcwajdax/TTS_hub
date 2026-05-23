const RATE_STORAGE_KEY = "tts-hub.playback.rate";

export const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export type PlaybackRate = (typeof PLAYBACK_RATE_OPTIONS)[number];

const DEFAULT_RATE: PlaybackRate = 1;

export function readStoredPlaybackRate(): PlaybackRate {
  try {
    const stored = window.localStorage.getItem(RATE_STORAGE_KEY);
    if (stored == null) return DEFAULT_RATE;
    const value = Number(stored);
    if (PLAYBACK_RATE_OPTIONS.includes(value as PlaybackRate)) {
      return value as PlaybackRate;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_RATE;
}

export function savePlaybackRate(rate: PlaybackRate): void {
  try {
    window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

export function formatPlaybackRateLabel(rate: number): string {
  if (rate === 1) return "1×";
  return `${rate}×`;
}
