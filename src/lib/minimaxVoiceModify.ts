import type { MinimaxSoundEffect, MinimaxVoiceModify } from "./minimaxOptions";

/** MiniMax `voice_modify` range for pitch / intensity / timbre. */
export const VOICE_MODIFY_MIN = -100;
export const VOICE_MODIFY_MAX = 100;

/**
 * Official MiniMax T2A `voice_modify` semantics (not `voice_setting.pitch`):
 * - pitch: Deepen/Brighten (−100 deeper, +100 brighter)
 * - intensity: Stronger/Softer (−100 stronger, +100 softer)
 * - timbre: Nasal/Crisp (−100 richer, +100 crisper)
 *
 * XY pad mapping (DAW-style placement):
 * - X → pitch (left deepen, right brighten)
 * - Y → intensity, inverted so up = stronger (API −100) and down = softer (API +100)
 * - timbre stays a linked slider
 */
export const VOICE_MODIFY_PAD = {
  xKey: "pitch",
  yKey: "intensity",
  yInvert: true,
} as const;

export const MINIMAX_SOUND_EFFECTS: {
  id: MinimaxSoundEffect;
  label: string;
  description: string;
}[] = [
  {
    id: "spacious_echo",
    label: "Przestrzenne echo",
    description: "Duże, otwarte pomieszczenie — długi pogłos.",
  },
  {
    id: "auditorium_echo",
    label: "Echo auli",
    description: "Sala / aula — wyraźne odbicia i obecność.",
  },
  {
    id: "lofi_telephone",
    label: "Telefon lo-fi",
    description: "Wąskie pasmo, jak stary słuchawka telefoniczna.",
  },
  {
    id: "robotic",
    label: "Robotyczny",
    description: "Metaliczna, syntetyczna barwa.",
  },
];

export function clampVoiceModifyAxis(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(VOICE_MODIFY_MAX, Math.max(VOICE_MODIFY_MIN, Math.round(n)));
}

export function emptyVoiceModify(): MinimaxVoiceModify {
  return { pitch: 0, intensity: 0, timbre: 0, sound_effects: null };
}

export function resolveVoiceModify(vm: MinimaxVoiceModify | null | undefined): MinimaxVoiceModify {
  const base = emptyVoiceModify();
  if (!vm) return base;
  return {
    pitch: clampVoiceModifyAxis(vm.pitch ?? 0),
    intensity: clampVoiceModifyAxis(vm.intensity ?? 0),
    timbre: clampVoiceModifyAxis(vm.timbre ?? 0),
    sound_effects: vm.sound_effects ?? null,
  };
}

export function isVoiceModifyIdentity(vm: MinimaxVoiceModify): boolean {
  return vm.pitch === 0 && vm.intensity === 0 && vm.timbre === 0 && !vm.sound_effects;
}

/** Omit a no-op `voice_modify` object so the API payload stays compact. */
export function compactVoiceModify(vm: MinimaxVoiceModify): MinimaxVoiceModify | null {
  const resolved = resolveVoiceModify(vm);
  return isVoiceModifyIdentity(resolved) ? null : resolved;
}

export interface VoiceModifyPadPoint {
  x: number;
  y: number;
}

export function voiceModifyToPad(vm: MinimaxVoiceModify): VoiceModifyPadPoint {
  return {
    x: clampVoiceModifyAxis(vm.pitch),
    y: clampVoiceModifyAxis(VOICE_MODIFY_PAD.yInvert ? -vm.intensity : vm.intensity),
  };
}

export function applyPadPoint(vm: MinimaxVoiceModify, x: number, y: number): MinimaxVoiceModify {
  return {
    ...vm,
    pitch: clampVoiceModifyAxis(x),
    intensity: clampVoiceModifyAxis(VOICE_MODIFY_PAD.yInvert ? -y : y),
  };
}

export function patchVoiceModify(
  current: MinimaxVoiceModify | null | undefined,
  patch: Partial<MinimaxVoiceModify>,
): MinimaxVoiceModify | null {
  return compactVoiceModify({ ...resolveVoiceModify(current), ...patch });
}
