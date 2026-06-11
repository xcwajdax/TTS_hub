import type { IconSlug } from "../../lib/icons";

export const SETTINGS_TAB_IDS = [
  "general",
  "providers",
  "voice_profiles",
  "audio_output",
  "usage",
  "filters",
  "quick_hotkeys",
  "cursor",
  "appearance",
  "avatars",
  "organization",
  "memory",
  "about",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export type SettingsTabGroup = "tts" | "integrations" | "system";

export interface SettingsTabMeta {
  id: SettingsTabId;
  label: string;
  icon: IconSlug;
  description: string;
  group: SettingsTabGroup;
}

export const SETTINGS_TAB_GROUPS: { id: SettingsTabGroup; label: string }[] = [
  { id: "tts", label: "TTS" },
  { id: "integrations", label: "Integracje" },
  { id: "system", label: "System" },
];

export const SETTINGS_TABS: SettingsTabMeta[] = [
  {
    id: "general",
    label: "Ogólne",
    icon: "info",
    description: "Kolejka generacji, tryb zapisu, ścieżki",
    group: "tts",
  },
  {
    id: "providers",
    label: "Providery",
    icon: "provider-google",
    description: "Włączone silniki TTS, klucze API, testy połączenia",
    group: "tts",
  },
  {
    id: "voice_profiles",
    label: "Profile głosu",
    icon: "provider-profiles",
    description: "Zapisane presety TTS — provider, model, głos, skróty",
    group: "tts",
  },
  {
    id: "audio_output",
    label: "Wyjście audio",
    icon: "play",
    description: "Urządzenie odtwarzania, status WebView2",
    group: "tts",
  },
  {
    id: "usage",
    label: "Zużycie",
    icon: "archive",
    description: "Tokeny i statystyki generacji (bieżąca sesja + łącznie)",
    group: "tts",
  },
  {
    id: "filters",
    label: "Filtry tekstu",
    icon: "clip-insert",
    description: "Presety filtrów, wbudowane reguły, własne reguły",
    group: "tts",
  },
  {
    id: "quick_hotkeys",
    label: "Szybkie skróty",
    icon: "save",
    description: "Globalne hotkeye TTS dla zaznaczonego tekstu w innych oknach",
    group: "integrations",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "source-cursor",
    description: "Integracja z Cursor Agent Chat — auto-TTS podsumowań",
    group: "integrations",
  },
  {
    id: "appearance",
    label: "Wygląd",
    icon: "spinner",
    description: "Skórka, styl timeline, rejestr skórek",
    group: "system",
  },
  {
    id: "avatars",
    label: "Awatary",
    icon: "clip-insert",
    description: "Awatary źródeł i głosów w historii",
    group: "system",
  },
  {
    id: "organization",
    label: "Archiwum / Foldery",
    icon: "folder",
    description: "Foldery, tagi, reguły automatycznego zapisu",
    group: "system",
  },
  {
    id: "memory",
    label: "Pamięć",
    icon: "trash",
    description: "Czyszczenie lokalnych plików (historia, archiwum, cache)",
    group: "system",
  },
  {
    id: "about",
    label: "O programie",
    icon: "info",
    description: "Wersja, ścieżki danych, linki",
    group: "system",
  },
];
