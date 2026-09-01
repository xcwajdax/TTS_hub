import { describe, expect, it, beforeEach, vi } from "vitest";

const store = new Map<string, string>();

vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  },
});

describe("playbackPositionLock", () => {
  beforeEach(() => {
    store.clear();
  });

  it("saves and restores position when lock enabled", async () => {
    vi.resetModules();
    const mod = await import("./playbackPositionLock");
    mod.setPlaybackPositionLockEnabled(true);
    mod.savePlaybackPosition("gen-1", 42.5);
    expect(mod.getSavedPlaybackPosition("gen-1")).toBe(42.5);
    mod.setPlaybackPositionLockEnabled(false);
    expect(mod.getSavedPlaybackPosition("gen-1")).toBeNull();
  });
});
