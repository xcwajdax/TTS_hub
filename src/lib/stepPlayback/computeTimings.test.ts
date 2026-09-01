import { describe, expect, it } from "vitest";
import { computeStepTimings } from "./computeTimings";
import { parseSteps } from "./parseSteps";

describe("computeStepTimings", () => {
  it("maps char ranges to proportional ms", () => {
    const parsed = parseSteps("1. Alpha\n2. Beta\n3. Gamma", { mode: "force" });
    expect(parsed).not.toBeNull();
    const timings = computeStepTimings(parsed!, 90_000, "1. Alpha\n2. Beta\n3. Gamma");
    expect(timings.steps).toHaveLength(3);
    expect(timings.steps[0].startMs).toBe(0);
    expect(timings.steps[2].endMs).toBe(90_000);
    expect(timings.steps[1].startMs).toBeGreaterThan(timings.steps[0].startMs);
  });
});
