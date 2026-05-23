import type { GenerationSource } from "../types";

/** Cursor hook (`cursor`) or agent skill (`cursor-skill`). */
export function isCursorPlaybackSource(
  source?: GenerationSource | string | null,
): boolean {
  return source === "cursor" || source === "cursor-skill";
}
