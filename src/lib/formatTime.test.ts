import { describe, expect, it } from "vitest";
import { formatDurationMs, formatGenerationMs, formatTime } from "./formatTime";

describe("formatTime", () => {
  it("pads seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(4)).toBe("0:04");
    expect(formatTime(75)).toBe("1:15");
  });
});

describe("formatDurationMs", () => {
  it("returns em dash for missing audio length", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(0)).toBe("—");
  });

  it("formats audio length as m:ss", () => {
    expect(formatDurationMs(4200)).toBe("0:04");
  });
});

describe("formatGenerationMs", () => {
  it("hides unknown or zero values", () => {
    expect(formatGenerationMs(null)).toBeNull();
    expect(formatGenerationMs(undefined)).toBeNull();
    expect(formatGenerationMs(0)).toBeNull();
  });

  it("uses tenths of a second below 10s", () => {
    expect(formatGenerationMs(1850)).toBe("1.9s");
    expect(formatGenerationMs(320)).toBe("0.3s");
  });

  it("uses whole seconds from 10s to under a minute", () => {
    expect(formatGenerationMs(12_400)).toBe("12s");
    expect(formatGenerationMs(59_400)).toBe("59s");
  });

  it("uses minutes and seconds from 60s up", () => {
    expect(formatGenerationMs(75_000)).toBe("1m 15s");
    expect(formatGenerationMs(183_000)).toBe("3m 03s");
  });
});
