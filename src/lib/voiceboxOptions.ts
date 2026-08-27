/** Mirror of Rust `VoiceBoxGenerationOptions` — keep in sync with voicebox.rs */

export type VoiceBoxModelSize = "1.7B" | "0.6B" | "1B" | "3B";

export const VOICEBOX_MODEL_SIZES: VoiceBoxModelSize[] = ["1.7B", "0.6B", "1B", "3B"];

export interface VoiceBoxGenerationOptions {
  seed?: number | null;
  model_size?: VoiceBoxModelSize | null;
  max_chunk_chars?: number | null;
  crossfade_ms?: number | null;
  normalize?: boolean | null;
}

export function defaultVoiceBoxGenerationOptions(): VoiceBoxGenerationOptions {
  return {
    seed: null,
    model_size: "1.7B",
    max_chunk_chars: 800,
    crossfade_ms: 50,
    normalize: true,
  };
}

export function mergeVoiceBoxGenerationOptions(
  saved?: VoiceBoxGenerationOptions | null,
): VoiceBoxGenerationOptions {
  return {
    ...defaultVoiceBoxGenerationOptions(),
    ...(saved ?? {}),
  };
}

export function compactVoiceBoxGenerationOptions(
  opts: VoiceBoxGenerationOptions,
): VoiceBoxGenerationOptions | null {
  const merged = mergeVoiceBoxGenerationOptions(opts);
  const def = defaultVoiceBoxGenerationOptions();
  const isDefault =
    (merged.seed ?? null) === (def.seed ?? null) &&
    (merged.model_size ?? "1.7B") === (def.model_size ?? "1.7B") &&
    (merged.max_chunk_chars ?? 800) === (def.max_chunk_chars ?? 800) &&
    (merged.crossfade_ms ?? 50) === (def.crossfade_ms ?? 50) &&
    (merged.normalize ?? true) === (def.normalize ?? true);
  return isDefault ? null : merged;
}
