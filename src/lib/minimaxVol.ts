import type { MinimaxClonedVoice } from "../api/tauri";

/** Preset Vol × mnożnik klonu (domyślnie 1), wynik 0–10 — zgodnie z backendem. */
export function effectiveMinimaxVol(
  presetVol: number,
  voiceId: string,
  cloned: MinimaxClonedVoice[],
): number {
  const base = Math.min(10, Math.max(0, presetVol));
  const entry = cloned.find((v) => v.voice_id === voiceId);
  const mult =
    entry?.output_vol != null
      ? Math.min(10, Math.max(0, entry.output_vol))
      : 1;
  return Math.min(10, Math.max(0, base * mult));
}

export function clonedVoiceOutputVol(
  cloned: MinimaxClonedVoice[],
  voiceId: string,
): number {
  const entry = cloned.find((v) => v.voice_id === voiceId);
  return entry?.output_vol ?? 1;
}
