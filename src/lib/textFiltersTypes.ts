export interface BuiltinFilterToggles {
  strip_fenced_code: boolean;
  strip_inline_code: boolean;
  strip_blockquotes: boolean;
}

export interface CustomTextFilter {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  replacement: string;
  flags?: string;
}

export interface TextFilterPreset {
  id: string;
  name: string;
  builtins: BuiltinFilterToggles;
  custom: CustomTextFilter[];
}

export interface TextFiltersSettings {
  active_preset_id: string | null;
  presets: TextFilterPreset[];
}

export type BuiltinFilterOverrides = Partial<BuiltinFilterToggles>;

export const DEFAULT_BUILTIN_TOGGLES: BuiltinFilterToggles = {
  strip_fenced_code: true,
  strip_inline_code: true,
  strip_blockquotes: false,
};

export function newCustomFilter(name = "Reguła"): CustomTextFilter {
  return {
    id: crypto.randomUUID(),
    name,
    enabled: true,
    pattern: "",
    replacement: "",
    flags: "g",
  };
}

export function newTextFilterPreset(name = "Domyślny"): TextFilterPreset {
  return {
    id: crypto.randomUUID(),
    name,
    builtins: { ...DEFAULT_BUILTIN_TOGGLES },
    custom: [],
  };
}

export function defaultTextFiltersSettings(): TextFiltersSettings {
  const preset = newTextFilterPreset("Domyślny");
  return {
    active_preset_id: preset.id,
    presets: [preset],
  };
}

export function resolveActivePreset(settings: TextFiltersSettings): TextFilterPreset {
  const { active_preset_id, presets } = settings;
  if (active_preset_id) {
    const found = presets.find((p) => p.id === active_preset_id);
    if (found) return found;
  }
  return presets[0] ?? newTextFilterPreset("Domyślny");
}

export function mergeBuiltinToggles(
  preset: TextFilterPreset,
  overrides?: BuiltinFilterOverrides | null,
): BuiltinFilterToggles {
  return { ...preset.builtins, ...overrides };
}
