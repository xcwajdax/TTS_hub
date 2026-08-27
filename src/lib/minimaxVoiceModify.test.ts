import { describe, expect, it } from "vitest";
import {
  applyPadPoint,
  compactVoiceModify,
  patchVoiceModify,
  resolveVoiceModify,
  voiceModifyToPad,
} from "./minimaxVoiceModify";

describe("voiceModify pad mapping", () => {
  it("maps X to pitch and inverted Y to intensity", () => {
    const vm = applyPadPoint(resolveVoiceModify(null), 40, 80);
    expect(vm.pitch).toBe(40);
    expect(vm.intensity).toBe(-80);
    expect(vm.timbre).toBe(0);
    const pad = voiceModifyToPad(vm);
    expect(pad).toEqual({ x: 40, y: 80 });
  });

  it("round-trips pad ↔ API including MiniMax polarity", () => {
    const original = resolveVoiceModify({
      pitch: -25,
      intensity: 60,
      timbre: 10,
      sound_effects: "robotic",
    });
    const pad = voiceModifyToPad(original);
    expect(pad).toEqual({ x: -25, y: -60 });
    const back = applyPadPoint(original, pad.x, pad.y);
    expect(back.pitch).toBe(-25);
    expect(back.intensity).toBe(60);
    expect(back.timbre).toBe(10);
    expect(back.sound_effects).toBe("robotic");
  });

  it("compacts identity values to null and keeps an effect", () => {
    expect(compactVoiceModify(resolveVoiceModify(null))).toBeNull();
    expect(
      compactVoiceModify({
        pitch: 0,
        intensity: 0,
        timbre: 0,
        sound_effects: "spacious_echo",
      })?.sound_effects,
    ).toBe("spacious_echo");
  });

  it("patches a single axis without dropping the rest", () => {
    const next = patchVoiceModify(
      { pitch: 10, intensity: -20, timbre: 5, sound_effects: null },
      { timbre: 0 },
    );
    expect(next).toEqual({ pitch: 10, intensity: -20, timbre: 0, sound_effects: null });
  });
});
