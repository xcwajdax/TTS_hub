export type VoiceboxSection = "profiles" | "history" | "tts_preset";

export const DEFAULT_VOICEBOX_SECTION: VoiceboxSection = "profiles";

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

export const VOICEBOX_ENGINES = [
  { id: "chatterbox", label: "Chatterbox" },
  { id: "chatterbox_turbo", label: "Chatterbox Turbo" },
  { id: "qwen", label: "Qwen TTS" },
  { id: "qwen_custom_voice", label: "Qwen Custom Voice" },
  { id: "luxtts", label: "LuxTTS" },
  { id: "tada", label: "TADA" },
  { id: "kokoro", label: "Kokoro" },
] as const;
