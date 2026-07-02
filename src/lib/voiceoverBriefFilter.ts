import {
  type BuiltinFilterOverrides,
  type TextFilterPreset,
} from "./textFiltersTypes";
import {
  applyTextFilters,
  type ApplyTextFiltersResult,
} from "./textFilters";
import {
  FACTORY_VOICEOVER_BRIEF_ID,
  getVoiceoverBriefPreset,
} from "./filterPresetCatalog";

export function isVoiceoverBriefPreset(preset: TextFilterPreset): boolean {
  return preset.id === FACTORY_VOICEOVER_BRIEF_ID;
}

function getVoiceoverBriefRelaxedPreset(): TextFilterPreset {
  const strict = getVoiceoverBriefPreset();
  const relaxedIds = new Set([
    "factory-vob-crlf",
    "factory-vob-meta",
    "factory-vob-meta-plain",
    "factory-vob-title",
    "factory-vob-production-tail",
    "factory-vob-hr",
    "factory-vob-section-ts",
    "factory-vob-section-plain",
    "factory-vob-headers",
    "factory-vob-bold",
    "factory-vob-paragraph-pause",
    "factory-vob-mic-emoji",
  ]);
  return {
    ...strict,
    custom: strict.custom
      .filter((r) => relaxedIds.has(r.id))
      .map((r) => ({ ...r })),
  };
}

function getVoiceoverBriefMinimalPreset(): TextFilterPreset {
  return {
    id: FACTORY_VOICEOVER_BRIEF_ID,
    name: "Voiceover / brief portfolio (minimal)",
    builtins: {
      strip_fenced_code: true,
      strip_inline_code: false,
      strip_blockquotes: false,
    },
    custom: [
      {
        id: "factory-vob-min-meta",
        name: "Metadane (luźno)",
        enabled: true,
        pattern:
          "(?:\\*\\*)?(Cel|Styl|Tempo|Długość|Goal|Style|Length)(?:\\*\\*)?:\\s*[^\\n]+",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-min-title",
        name: "Tytuł briefu",
        enabled: true,
        pattern: "^#?\\s*🎙️?\\s*Brief audio[^\\n]*$",
        replacement: "",
        flags: "gim",
      },
      {
        id: "factory-vob-min-timing",
        name: "Notatki od TIMING",
        enabled: true,
        pattern: "(?:^|\\n)\\s*#{0,3}\\s*TIMING\\b[\\s\\S]*$",
        replacement: "",
        flags: "i",
      },
      {
        id: "factory-vob-min-bold",
        name: "Bold",
        enabled: true,
        pattern: "\\*\\*([^*]+)\\*\\*",
        replacement: "$1",
        flags: "g",
      },
    ],
  };
}

function mergeWarnings(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const w of g) {
      if (!seen.has(w)) {
        seen.add(w);
        out.push(w);
      }
    }
  }
  return out;
}

/**
 * Voiceover brief: strict preset → relaxed → minimal → surowy tekst (znormalizowany).
 */
export function applyVoiceoverBriefFilters(
  input: string,
  preset: TextFilterPreset,
  sessionOverrides?: BuiltinFilterOverrides | null,
): ApplyTextFiltersResult {
  const originalLen = input.length;
  const strict = applyTextFilters(input, preset, sessionOverrides);
  if (strict.output.trim().length > 0) return strict;

  const relaxed = applyTextFilters(
    input,
    getVoiceoverBriefRelaxedPreset(),
    sessionOverrides,
  );
  if (relaxed.output.trim().length > 0) {
    return {
      output: relaxed.output,
      removedChars: Math.max(0, originalLen - relaxed.output.length),
      warnings: mergeWarnings(strict.warnings, relaxed.warnings, [
        "Voiceover: użyto trybu relaxed (strict dał pusty wynik).",
      ]),
    };
  }

  const minimal = applyTextFilters(
    input,
    getVoiceoverBriefMinimalPreset(),
    sessionOverrides,
  );
  if (minimal.output.trim().length > 0) {
    return {
      output: minimal.output,
      removedChars: Math.max(0, originalLen - minimal.output.length),
      warnings: mergeWarnings(strict.warnings, minimal.warnings, [
        "Voiceover: użyto trybu minimal.",
      ]),
    };
  }

  const trimmed = input.replace(/\s+/g, " ").trim();
  return {
    output: trimmed,
    removedChars: Math.max(0, originalLen - trimmed.length),
    warnings: mergeWarnings(strict.warnings, [
      "Voiceover: filtry usunęły cały tekst — użyto surowego wejścia.",
    ]),
  };
}

export function applyTextFiltersForPreset(
  input: string,
  preset: TextFilterPreset,
  sessionOverrides?: BuiltinFilterOverrides | null,
): ApplyTextFiltersResult {
  if (isVoiceoverBriefPreset(preset)) {
    return applyVoiceoverBriefFilters(input, preset, sessionOverrides);
  }
  return applyTextFilters(input, preset, sessionOverrides);
}
