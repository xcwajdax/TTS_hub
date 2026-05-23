import type { TextFilterPreset } from "./textFiltersTypes";
import { DEFAULT_BUILTIN_TOGGLES } from "./textFiltersTypes";

/** Stable factory preset ids — merged into user settings without overwriting custom presets. */
export const FACTORY_PRESET_IDS = [
  "factory-default",
  "factory-narration",
  "factory-docs",
  "factory-cursor-summary",
] as const;

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
];

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
