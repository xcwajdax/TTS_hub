import { DEFAULT_MINIMAX_LANGUAGE, DEFAULT_MINIMAX_VOICE_ID } from "../appSettings";
import type { MinimaxPresetVoice } from "../api/tauri";

/** Mirror of Rust `MINIMAX_LANGUAGES` — keep in sync with `src-tauri/src/minimax.rs`. */
export const MINIMAX_LANGUAGE_CATALOG = [
  { code: "pl", language_boost: "Polish", display_name: "Polski" },
  { code: "en", language_boost: "English", display_name: "Angielski" },
] as const;

export type MinimaxLanguageCode = (typeof MINIMAX_LANGUAGE_CATALOG)[number]["code"];

export function isMinimaxLanguageCode(code: string): boolean {
  const c = code.trim().toLowerCase();
  return MINIMAX_LANGUAGE_CATALOG.some((l) => l.code === c);
}

export function minimaxLanguageLabel(code: string): string {
  const c = code.trim().toLowerCase();
  return MINIMAX_LANGUAGE_CATALOG.find((l) => l.code === c)?.display_name ?? code;
}

/** Empty `enabled` = all catalog languages (matches Rust `effective_enabled_language_codes`). */
export function effectiveMinimaxEnabledLanguages(enabled: string[] | undefined): string[] {
  if (!enabled || enabled.length === 0) {
    return MINIMAX_LANGUAGE_CATALOG.map((l) => l.code);
  }
  const valid = enabled.map((c) => c.trim().toLowerCase()).filter(isMinimaxLanguageCode);
  const deduped = [...new Set(valid)];
  return deduped.length > 0 ? deduped : [DEFAULT_MINIMAX_LANGUAGE];
}

export function defaultMinimaxVoiceForLanguage(languageCode: string): string {
  const c = languageCode.trim().toLowerCase();
  if (c === "en") return "English_expressive_narrator";
  return DEFAULT_MINIMAX_VOICE_ID;
}

export function filterMinimaxPresetsByLanguage(
  presets: MinimaxPresetVoice[],
  languageCode: string,
): MinimaxPresetVoice[] {
  const c = languageCode.trim().toLowerCase();
  return presets.filter((p) => p.language === c);
}

export function pickMinimaxVoiceForLanguage(
  presets: MinimaxPresetVoice[],
  languageCode: string,
  currentVoice: string,
  clonedVoiceIds: Set<string>,
): string {
  if (clonedVoiceIds.has(currentVoice)) return currentVoice;
  const forLang = filterMinimaxPresetsByLanguage(presets, languageCode);
  if (forLang.some((p) => p.voice_id === currentVoice)) return currentVoice;
  return forLang[0]?.voice_id ?? defaultMinimaxVoiceForLanguage(languageCode);
}
