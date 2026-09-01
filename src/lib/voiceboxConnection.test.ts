import { describe, expect, it } from "vitest";
import {
  voiceboxHeaderStatusLine,
  voiceboxInstanceKindLabel,
  voiceboxStorageHint,
} from "./voiceboxConnection";

describe("voiceboxInstanceKindLabel", () => {
  it("labels an external LAN/remote instance", () => {
    expect(voiceboxInstanceKindLabel("external")).toBe("zewnętrzna instancja Voicebox");
    expect(voiceboxInstanceKindLabel(undefined)).toBe("zewnętrzna instancja Voicebox");
  });

  it("labels the bundled sidecar", () => {
    expect(voiceboxInstanceKindLabel("bundled")).toBe(
      "silnik wbudowany (TTS Hub uruchamia proces)",
    );
  });
});

describe("voiceboxHeaderStatusLine", () => {
  it("puts the server URL next to a healthy connection", () => {
    expect(
      voiceboxHeaderStatusLine({
        reachable: true,
        baseUrl: "http://192.168.0.251:17493",
        healthStatus: "ok",
        gpuLabel: "CUDA",
        modelLoaded: true,
      }),
    ).toBe("Połączenie sprawne · http://192.168.0.251:17493 · ok · CUDA · model załadowany");
  });

  it("still shows the configured URL when unreachable", () => {
    expect(
      voiceboxHeaderStatusLine({
        reachable: false,
        baseUrl: "http://192.168.0.251:17493",
      }),
    ).toBe("Brak połączenia · http://192.168.0.251:17493");
  });
});

describe("voiceboxStorageHint", () => {
  it("says weights live on the Voicebox server", () => {
    expect(voiceboxStorageHint()).toMatch(/na tym serwerze/i);
    expect(voiceboxStorageHint()).toMatch(/nie w aplikacji TTS Hub/i);
  });
});
