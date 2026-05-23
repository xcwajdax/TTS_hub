import type { BuiltinFilterOverrides } from "./textFiltersTypes";

const STORAGE_KEY = "tts-hub.text-filters.session";

export interface TextFiltersSession {
  builtinOverrides: BuiltinFilterOverrides;
}

export function loadTextFiltersSession(): TextFiltersSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { builtinOverrides: {} };
    const parsed = JSON.parse(raw) as TextFiltersSession;
    return { builtinOverrides: parsed.builtinOverrides ?? {} };
  } catch {
    return { builtinOverrides: {} };
  }
}

export function saveTextFiltersSession(session: TextFiltersSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

export function updateBuiltinOverrides(overrides: BuiltinFilterOverrides): void {
  saveTextFiltersSession({ builtinOverrides: overrides });
}
