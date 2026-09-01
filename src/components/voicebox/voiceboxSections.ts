export type VoiceboxSection = "models" | "profiles" | "history" | "log";

export const DEFAULT_VOICEBOX_SECTION: VoiceboxSection = "models";

export type CloneProfilePrefill = {
  default_engine: "chatterbox" | "tada";
  tada_size?: "1B" | "3B";
};

export const VOICEBOX_LANGUAGES = [
  { code: "pl", label: "Polski" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "pt", label: "Português" },
  { code: "tr", label: "Türkçe" },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "ar", label: "العربية" },
  { code: "he", label: "עברית" },
  { code: "hi", label: "हिन्दी" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "sw", label: "Kiswahili" },
  { code: "el", label: "Ελληνικά" },
] as const;

/** Engines exposed in TTS Hub for PL voice cloning. */
export const VOICEBOX_ENGINES = [
  { id: "chatterbox", label: "Chatterbox" },
  { id: "tada", label: "TADA" },
] as const;

export const VOICEBOX_TADA_SIZES = [
  { id: "1B" as const, label: "TADA 1B", model_name: "tada-1b", hub_id: "voicebox:tada-1b" },
  { id: "3B" as const, label: "TADA 3B", model_name: "tada-3b-ml", hub_id: "voicebox:tada-3b-ml" },
] as const;
