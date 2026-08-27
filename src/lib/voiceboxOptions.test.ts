import { describe, expect, it } from "vitest";
import {
  compactVoiceBoxGenerationOptions,
  defaultVoiceBoxGenerationOptions,
  mergeVoiceBoxGenerationOptions,
} from "./voiceboxOptions";

describe("voicebox generation options", () => {
  it("compacts default values to null", () => {
    expect(compactVoiceBoxGenerationOptions(defaultVoiceBoxGenerationOptions())).toBeNull();
  });

  it("keeps a non-default seed", () => {
    const next = compactVoiceBoxGenerationOptions({
      ...defaultVoiceBoxGenerationOptions(),
      seed: 42,
    });
    expect(next?.seed).toBe(42);
    expect(next?.normalize).toBe(true);
  });

  it("fills missing keys from defaults", () => {
    const merged = mergeVoiceBoxGenerationOptions({ seed: 1 });
    expect(merged.model_size).toBe("1.7B");
    expect(merged.max_chunk_chars).toBe(800);
    expect(merged.seed).toBe(1);
  });
});
