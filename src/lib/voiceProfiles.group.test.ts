import { describe, expect, it } from "vitest";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";
import { DEFAULT_TTS_SETTINGS } from "../hooks/useTtsSettings";
import {
  applyModelToVoiceProfile,
  generationMatchesProfile,
  groupProfilesByProvider,
  profileMatchesSettings,
  voiceProfileProviderKey,
  voiceProfileProviderLabel,
} from "./voiceProfiles";

function vp(
  partial: Partial<TtsVoiceProfile> & Pick<TtsVoiceProfile, "id" | "name" | "provider">,
): TtsVoiceProfile {
  return {
    model: "m",
    voice: "v",
    style: null,
    profile_id: null,
    language: "pl",
    engine: null,
    minimax_speed: null,
    minimax_vol: null,
    minimax_pitch: null,
    multi_speaker: false,
    speakers: [],
    ...partial,
  };
}

describe("groupProfilesByProvider", () => {
  it("groups by TTS provider in Google → Voice Box → MiniMax order", () => {
    const groups = groupProfilesByProvider([
      vp({ id: "mm", name: "Kasia", provider: "minimax" }),
      vp({ id: "g", name: "Narracja", provider: "google" }),
      vp({ id: "vb", name: "Klon", provider: "voicebox" }),
    ]);
    expect(groups.map((g) => g.provider)).toEqual(["google", "voicebox", "minimax"]);
    expect(groups.map((g) => g.label)).toEqual(["Google Gemini", "Voice Box", "MiniMax"]);
    expect(groups.map((g) => g.profiles.map((p) => p.id))).toEqual([["g"], ["vb"], ["mm"]]);
  });

  it("omits providers that have no profiles", () => {
    const groups = groupProfilesByProvider([
      vp({ id: "mm", name: "Kasia", provider: "minimax" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.provider).toBe("minimax");
  });

  it("sorts within a group by last preview, then name", () => {
    const groups = groupProfilesByProvider([
      vp({ id: "a", name: "Beta", provider: "google", last_preview_at: 10 }),
      vp({ id: "b", name: "Alfa", provider: "google", last_preview_at: 10 }),
      vp({ id: "c", name: "Gamma", provider: "google", last_preview_at: 50 }),
    ]);
    expect(groups[0]?.profiles.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("treats a missing provider as Google and appends unknown providers last", () => {
    expect(voiceProfileProviderKey(vp({ id: "x", name: "X", provider: "" }))).toBe("google");
    expect(voiceProfileProviderLabel("custom-cloud")).toBe("custom-cloud");
    const groups = groupProfilesByProvider([
      vp({ id: "u", name: "Obcy", provider: "custom-cloud" }),
      vp({ id: "g", name: "Kore", provider: "google" }),
    ]);
    expect(groups.map((g) => g.provider)).toEqual(["google", "custom-cloud"]);
  });
});

describe("applyModelToVoiceProfile", () => {
  it("updates model and Voice Box engine", () => {
    const profile = vp({
      id: "vb",
      name: "Klon",
      provider: "voicebox",
      model: "voicebox:chatterbox",
      engine: "chatterbox",
      profile_id: "srv-1",
    });
    const next = applyModelToVoiceProfile(profile, "voicebox:tada-3b-ml");
    expect(next.model).toBe("voicebox:tada-3b-ml");
    expect(next.engine).toBe("tada");
    expect(next.profile_id).toBe("srv-1");
  });
});

describe("Voice Box profile matching ignores generation model", () => {
  const profile = vp({
    id: "vb",
    name: "Klon",
    provider: "voicebox",
    model: "voicebox:chatterbox",
    voice: "Klon",
    profile_id: "srv-1",
  });

  it("matches settings after switching the Hub model", () => {
    expect(
      profileMatchesSettings(profile, {
        ...DEFAULT_TTS_SETTINGS,
        provider: "voicebox",
        model: "voicebox:tada-1b",
        voice: "Klon",
        voiceboxProfileId: "srv-1",
      }),
    ).toBe(true);
  });

  it("matches a generation produced with a different Voice Box engine", () => {
    const gen: Generation = {
      id: "g1",
      created_at: 1,
      text: "cześć",
      title: null,
      model: "voicebox:tada-1b",
      voice: "Klon",
      style: null,
      format: "wav",
      duration_ms: 100,
      file_path: "x.wav",
      is_archived: false,
      session_id: "s",
      source: "manual",
      conversation_id: null,
      summary_text: null,
      status: "done",
      error: null,
      attempts: 1,
      updated_at: 1,
      provider: "voicebox",
    };
    expect(generationMatchesProfile(gen, profile)).toBe(true);
  });
});
