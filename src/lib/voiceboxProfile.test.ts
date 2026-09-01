import { describe, expect, it } from "vitest";
import { voiceboxModelsForPicker } from "./voiceboxProfile";

describe("voiceboxModelsForPicker", () => {
  it("uses fallback models when the live list is empty", () => {
    const options = voiceboxModelsForPicker([], "voicebox:chatterbox");
    expect(options.map((m) => m.id)).toEqual([
      "voicebox:chatterbox",
      "voicebox:tada-1b",
      "voicebox:tada-3b-ml",
    ]);
    expect(options[0]?.display_name).toBe("Chatterbox");
  });

  it("keeps the current model even when it is missing from the live list", () => {
    const options = voiceboxModelsForPicker(
      [{ id: "voicebox:chatterbox", display_name: "Voice Box Chatterbox (loaded)" }],
      "voicebox:tada-3b-ml",
    );
    expect(options[0]).toEqual({ id: "voicebox:tada-3b-ml", display_name: "TADA 3B" });
    expect(options.map((m) => m.id)).toContain("voicebox:chatterbox");
  });

  it("strips loaded markers in compact option labels", () => {
    const options = voiceboxModelsForPicker(
      [{ id: "voicebox:tada-1b", display_name: "Voice Box TADA 1B (loaded)" }],
      "voicebox:tada-1b",
    );
    expect(options).toEqual([{ id: "voicebox:tada-1b", display_name: "TADA 1B" }]);
  });
});
