import { describe, expect, it } from "vitest";
import { parseSteps } from "./parseSteps";

describe("parseSteps", () => {
  it("detects numbered PL tutorial lines", () => {
    const text = `Wstęp do tutoriala.

1. Otwórz Blender
2. Dodaj sześcian
3. Zastosuj materiał`;

    const result = parseSteps(text, { minSteps: 2 });
    expect(result).not.toBeNull();
    expect(result!.steps).toHaveLength(3);
    expect(result!.steps[0].text).toContain("Blender");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("rejects single numbered line in auto mode", () => {
    const result = parseSteps("1. Tylko jeden krok", { minSteps: 2, mode: "auto" });
    expect(result).toBeNull();
  });

  it("force mode returns one step", () => {
    const result = parseSteps("Jedyny krok instrukcji", { mode: "force" });
    expect(result?.steps).toHaveLength(1);
  });
});
