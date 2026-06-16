import { listHistory } from "../../api/tauri";
import type { Generation } from "../../types";

/** Find a generation by id in session then archive. */
export async function findGenerationById(id: string): Promise<Generation | null> {
  for (const scope of ["session", "archive"] as const) {
    try {
      const list = await listHistory(scope);
      const hit = list.find((g) => g.id === id);
      if (hit) return hit;
    } catch {
      // try next scope
    }
  }
  return null;
}
