import type { TextFilterPreset } from "./textFiltersTypes";
import { DEFAULT_BUILTIN_TOGGLES } from "./textFiltersTypes";

/** Stable factory preset ids — merged into user settings without overwriting custom presets. */
export const FACTORY_PRESET_IDS = [
  "factory-default",
  "factory-narration",
  "factory-docs",
  "factory-cursor-summary",
  "factory-voiceover-brief",
] as const;

/** Factory preset for portfolio / social voiceover scripts (markdown briefs). */
export const FACTORY_VOICEOVER_BRIEF_ID = "factory-voiceover-brief";

/** Target speaking rate for voiceover brief preset (~90–100 wpm). */
export const VOICEOVER_BRIEF_TARGET_WPM = 95;

export const FACTORY_PRESETS: TextFilterPreset[] = [
  {
    id: "factory-default",
    name: "Domyślny",
    builtins: { ...DEFAULT_BUILTIN_TOGGLES },
    custom: [],
  },
  {
    id: "factory-narration",
    name: "Narracja",
    builtins: {
      strip_fenced_code: false,
      strip_inline_code: false,
      strip_blockquotes: false,
    },
    custom: [],
  },
  {
    id: "factory-docs",
    name: "Dokumentacja / kod",
    builtins: {
      strip_fenced_code: true,
      strip_inline_code: true,
      strip_blockquotes: true,
    },
    custom: [
      {
        id: "factory-docs-url",
        name: "Usuń URL",
        enabled: true,
        pattern: "https?://\\S+",
        replacement: "",
        flags: "g",
      },
    ],
  },
  {
    id: "factory-cursor-summary",
    name: "Podsumowanie Cursor",
    builtins: {
      strip_fenced_code: true,
      strip_inline_code: true,
      strip_blockquotes: false,
    },
    custom: [
      {
        id: "factory-cursor-tts-markers",
        name: "Markery tts-summary",
        enabled: true,
        pattern: "<!--\\s*tts-summary\\s*-->|<!--\\s*/tts-summary\\s*-->",
        replacement: "",
        flags: "gi",
      },
    ],
  },
  {
    id: FACTORY_VOICEOVER_BRIEF_ID,
    name: "Voiceover / brief portfolio",
    builtins: {
      strip_fenced_code: true,
      strip_inline_code: true,
      strip_blockquotes: false,
    },
    custom: [
      {
        id: "factory-vob-crlf",
        name: "Normalizacja CRLF",
        enabled: true,
        pattern: "\\r\\n",
        replacement: "\n",
        flags: "g",
      },
      {
        id: "factory-vob-meta",
        name: "Metadane produkcyjne",
        enabled: true,
        pattern: "^\\*\\*(Cel|Styl|Tempo|Długość|Goal|Style|Length):\\*\\*.*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-meta-plain",
        name: "Metadane (bez markdown)",
        enabled: true,
        pattern: "^\\s*(Cel|Styl|Tempo|Długość|Goal|Style|Length):\\s*.*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-title",
        name: "Tytuł briefu",
        enabled: true,
        pattern: "^#?\\s*🎙️?\\s*Brief audio[^\\n]*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-production-tail",
        name: "Notatki produkcyjne (TIMING+)",
        enabled: true,
        pattern: "(?:^|\\n)\\s*#{0,3}\\s*TIMING\\b[\\s\\S]*$",
        replacement: "",
        flags: "i",
      },
      {
        id: "factory-vob-hr",
        name: "Separatory",
        enabled: true,
        pattern: "^\\s*[-*]{3,}\\s*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-section-ts",
        name: "Nagłówki sekcji z czasem",
        enabled: true,
        pattern:
          "^#{1,3}\\s+[A-ZĄĆĘŁŃÓŚŹŻ\\s]+\\(\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}\\)\\s*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-section-plain",
        name: "Nagłówki sekcji (bez #)",
        enabled: true,
        pattern:
          "^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9\\s]+\\(\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}\\)\\s*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-headers",
        name: "Nagłówki markdown",
        enabled: true,
        pattern: "^#{1,6}\\s+.+$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-table-row",
        name: "Wiersze tabel markdown",
        enabled: true,
        pattern: "^\\|.+\\|$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-bold",
        name: "Bold",
        enabled: true,
        pattern: "\\*\\*([^*]+)\\*\\*",
        replacement: "$1",
        flags: "g",
      },
      {
        id: "factory-vob-paragraph-pause",
        name: "Pauzy akapitów",
        enabled: true,
        pattern: "\\n{2,}",
        replacement: " ... ",
        flags: "g",
      },
      {
        id: "factory-vob-trim-pause",
        name: "Usuń wiodącą pauzę",
        enabled: true,
        pattern: "^\\s*\\.\\.\\.\\s+",
        replacement: "",
        flags: "",
      },
      {
        id: "factory-vob-trim-pause-end",
        name: "Usuń końcową pauzę",
        enabled: true,
        pattern: "\\s+\\.\\.\\.\\s*$",
        replacement: "",
        flags: "",
      },
      {
        id: "factory-vob-mic-emoji",
        name: "Emoji mikrofonu",
        enabled: true,
        pattern: "🎙️",
        replacement: "",
        flags: "g",
      },
    ],
  },
];

export function getVoiceoverBriefPreset(): TextFilterPreset {
  const preset = FACTORY_PRESETS.find((p) => p.id === FACTORY_VOICEOVER_BRIEF_ID);
  if (!preset) {
    throw new Error("factory-voiceover-brief preset missing");
  }
  return {
    ...preset,
    builtins: { ...preset.builtins },
    custom: preset.custom.map((c) => ({ ...c })),
  };
}

export function mergeFactoryPresets(presets: TextFilterPreset[]): TextFilterPreset[] {
  const byId = new Map(presets.map((p) => [p.id, p]));
  const merged = [...presets];
  for (const factory of FACTORY_PRESETS) {
    if (!byId.has(factory.id)) {
      merged.push({ ...factory, custom: factory.custom.map((c) => ({ ...c })) });
    }
  }
  return merged;
}

export function ensureTextFiltersWithFactory(
  settings: { active_preset_id: string | null; presets: TextFilterPreset[] },
): { active_preset_id: string | null; presets: TextFilterPreset[] } {
  const presets = mergeFactoryPresets(settings.presets);
  const active =
    settings.active_preset_id && presets.some((p) => p.id === settings.active_preset_id)
      ? settings.active_preset_id
      : presets.find((p) => p.id === "factory-default")?.id ?? presets[0]?.id ?? null;
  return { active_preset_id: active, presets };
}
