import { describe, expect, it } from "vitest";
import { formatModelLabel, shortModelLabel } from "./ttsModels";

describe("shortModelLabel", () => {
  it("uses compact Voice Box names", () => {
    expect(shortModelLabel("voicebox:chatterbox")).toBe("Chatterbox");
    expect(shortModelLabel("voicebox:tada-1b")).toBe("TADA 1B");
    expect(shortModelLabel("voicebox:tada-3b-ml")).toBe("TADA 3B");
  });

  it("strips Voice Box prefix and loaded marker from API display names", () => {
    expect(
      shortModelLabel("voicebox:custom-engine", [
        { id: "voicebox:custom-engine", display_name: "Voice Box Custom Engine (loaded)" },
      ]),
    ).toBe("Custom Engine");
  });
});

describe("formatModelLabel", () => {
  it("falls back to compact Voice Box names without a models list", () => {
    expect(formatModelLabel("voicebox:tada-1b")).toBe("TADA 1B");
  });
});
