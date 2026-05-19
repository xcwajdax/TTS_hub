export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  return formatTime(ms / 1000);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function speechRateCharsPerSec(charCount: number, durationMs: number | null): string | null {
  if (charCount <= 0 || durationMs == null || durationMs <= 0) return null;
  const rate = charCount / (durationMs / 1000);
  if (!Number.isFinite(rate)) return null;
  return `~${Math.round(rate)} zn/s`;
}
