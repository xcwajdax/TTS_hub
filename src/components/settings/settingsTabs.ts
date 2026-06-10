import type { IconSlug } from "../../lib/icons";

export const SETTINGS_TAB_IDS = [
  "general",
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

export interface SettingsTabMeta {
  id: SettingsTabId;
  label: string;
  icon: IconSlug;
  description: string;
}

export const SETTINGS_TABS: SettingsTabMeta[] = [
  {
    id: "general",
    label: "Ogólne",
    icon: "info",
    description: "Providery, kolejka generacji, tryb zapisu, ścieżki, profile API",
  },
  {
    id: "audio_output",
    label: "Wyjście audio",
    icon: "play",
    description: "Urządzenie odtwarzania, status WebView2",
  },
  {
    id: "usage",
    label: "Zużycie",
    icon: "archive",
    description: "Tokeny i statystyki generacji (bieżąca sesja + łącznie)",
  },
  {
    id: "filters",
    label: "Filtry tekstu",
    icon: "clip-insert",
    description: "Presety filtrów, wbudowane reguły, własne reguły",
  },
  {
    id: "quick_hotkeys",
    label: "Szybkie skróty",
    icon: "save",
    description: "Globalne hotkeye TTS dla zaznaczonego tekstu w innych oknach",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "source-cursor",
    description: "Integracja z Cursor Agent Chat — auto-TTS podsumowań",
  },
  {
    id: "appearance",
    label: "Wygląd",
    icon: "spinner",
    description: "Skórka, styl timeline, rejestr skórek",
  },
  {
    id: "avatars",
    label: "Awatary",
    icon: "clip-insert",
    description: "Awatary źródeł i głosów w historii",
  },
  {
    id: "organization",
    label: "Archiwum / Foldery",
    icon: "folder",
    description: "Foldery, tagi, reguły automatycznego zapisu",
  },
  {
    id: "memory",
    label: "Pamięć",
    icon: "trash",
    description: "Czyszczenie lokalnych plików (historia, archiwum, cache)",
  },
  {
    id: "about",
    label: "O programie",
    icon: "info",
    description: "Wersja, ścieżki danych, linki",
  },
];
