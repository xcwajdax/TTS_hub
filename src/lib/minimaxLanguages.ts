import { DEFAULT_MINIMAX_LANGUAGE, DEFAULT_MINIMAX_VOICE_ID } from "../appSettings";
import type { MinimaxPresetVoice } from "../api/tauri";

/** Mirror of Rust `MINIMAX_LANGUAGE_CATALOG` — keep in sync with minimax_options.rs */
export const MINIMAX_LANGUAGE_CATALOG = [
  { code: "pl", language_boost: "Polish", display_name: "Polski" },
  { code: "en", language_boost: "English", display_name: "Angielski" },
  { code: "zh", language_boost: "Chinese", display_name: "Chiński (mandaryński)" },
  { code: "yue", language_boost: "Chinese,Yue", display_name: "Kantoński" },
  { code: "ar", language_boost: "Arabic", display_name: "Arabski" },
  { code: "ru", language_boost: "Russian", display_name: "Rosyjski" },
  { code: "es", language_boost: "Spanish", display_name: "Hiszpański" },
  { code: "fr", language_boost: "French", display_name: "Francuski" },
  { code: "pt", language_boost: "Portuguese", display_name: "Portugalski" },
  { code: "de", language_boost: "German", display_name: "Niemiecki" },
  { code: "tr", language_boost: "Turkish", display_name: "Turecki" },
  { code: "nl", language_boost: "Dutch", display_name: "Niderlandzki" },
  { code: "uk", language_boost: "Ukrainian", display_name: "Ukraiński" },
  { code: "vi", language_boost: "Vietnamese", display_name: "Wietnamski" },
  { code: "id", language_boost: "Indonesian", display_name: "Indonezyjski" },
  { code: "ja", language_boost: "Japanese", display_name: "Japoński" },
  { code: "it", language_boost: "Italian", display_name: "Włoski" },
  { code: "ko", language_boost: "Korean", display_name: "Koreański" },
  { code: "th", language_boost: "Thai", display_name: "Tajski" },
  { code: "ro", language_boost: "Romanian", display_name: "Rumuński" },
  { code: "el", language_boost: "Greek", display_name: "Grecki" },
  { code: "cs", language_boost: "Czech", display_name: "Czeski" },
  { code: "fi", language_boost: "Finnish", display_name: "Fiński" },
  { code: "hi", language_boost: "Hindi", display_name: "Hindi" },
  { code: "bg", language_boost: "Bulgarian", display_name: "Bułgarski" },
  { code: "da", language_boost: "Danish", display_name: "Duński" },
  { code: "he", language_boost: "Hebrew", display_name: "Hebrajski" },
  { code: "ms", language_boost: "Malay", display_name: "Malajski" },
  { code: "fa", language_boost: "Persian", display_name: "Perski" },
  { code: "sk", language_boost: "Slovak", display_name: "Słowacki" },
  { code: "sv", language_boost: "Swedish", display_name: "Szwedzki" },
  { code: "hr", language_boost: "Croatian", display_name: "Chorwacki" },
  { code: "fil", language_boost: "Filipino", display_name: "Filipiński" },
  { code: "hu", language_boost: "Hungarian", display_name: "Węgierski" },
  { code: "no", language_boost: "Norwegian", display_name: "Norweski" },
  { code: "sl", language_boost: "Slovenian", display_name: "Słoweński" },
  { code: "ca", language_boost: "Catalan", display_name: "Kataloński" },
  { code: "nn", language_boost: "Nynorsk", display_name: "Nynorsk" },
  { code: "ta", language_boost: "Tamil", display_name: "Tamilski" },
  { code: "af", language_boost: "Afrikaans", display_name: "Afrikaans" },
  { code: "auto", language_boost: "auto", display_name: "Auto-wykrywanie" },
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

export function languageBoostForCode(code: string): string {
  const c = code.trim().toLowerCase();
  return MINIMAX_LANGUAGE_CATALOG.find((l) => l.code === c)?.language_boost ?? "auto";
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
