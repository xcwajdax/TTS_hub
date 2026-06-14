import type { Generation } from "../types";

/** Generation row is ready for timeline / HTTP audio playback. */
export function isGenerationPlayable(g: Generation): boolean {
  return g.status === "done" && Boolean(g.file_path?.trim());
}

/**
 * Session and archive lists overlap (archived rows appear in both).
 * Merge by id; archive entry wins so file_path / flags stay current.
 */
export function mergeSessionAndArchiveHistory(
  session: Generation[],
  archive: Generation[],
): Generation[] {
  const byId = new Map<string, Generation>();
  for (const g of session) byId.set(g.id, g);
  for (const g of archive) byId.set(g.id, g);
  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}
