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

/** Wall-clock synthesis time. Null when unknown (legacy rows). */
export function formatGenerationMs(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 10_000) return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
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
