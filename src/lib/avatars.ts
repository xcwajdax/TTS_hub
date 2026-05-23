import { convertFileSrc } from "@tauri-apps/api/core";
import type { Generation, GenerationSource, TtsProvider } from "../types";

export const AVATAR_SIZE = 512;
export const AVATARS_CHANGED = "tts-hub-avatars-changed";

export type AvatarInfo = {
  exists: boolean;
  path: string | null;
};

export function notifyAvatarsChanged(): void {
  window.dispatchEvent(new Event(AVATARS_CHANGED));
}

export function avatarSrc(filePath: string, cacheKey?: number): string {
  const base = convertFileSrc(filePath);
  if (cacheKey == null) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${cacheKey}`;
}

export function voiceAvatarKey(provider: TtsProvider, voiceId: string): string {
  return `${provider}:${voiceId}`;
}

export function inferGenerationProvider(gen: Generation): TtsProvider {
  const p = gen.provider;
  if (p === "google" || p === "minimax" || p === "voicebox") return p;
  if (gen.model.startsWith("minimax:")) return "minimax";
  if (gen.model.startsWith("voicebox:")) return "voicebox";
  return "google";
}

export const SOURCE_AVATAR_IDS: GenerationSource[] = [
  "manual",
  "cursor",
  "cursor-skill",
  "quick_hotkey",
  "http",
];
