import {
  type BuiltinFilterOverrides,
  type BuiltinFilterToggles,
  type TextFilterPreset,
  mergeBuiltinToggles,
} from "./textFiltersTypes";

export interface ApplyTextFiltersResult {
  output: string;
  removedChars: number;
  warnings: string[];
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function applyBuiltinFilters(text: string, builtins: BuiltinFilterToggles): string {
  let out = text;
  if (builtins.strip_fenced_code) {
    out = out.replace(/```[\s\S]*?```/g, " ");
  }
  if (builtins.strip_inline_code) {
    out = out.replace(/`[^`]*`/g, " ");
  }
  if (builtins.strip_blockquotes) {
    out = out.replace(/^[ \t]*>\s?.*$/gm, " ");
  }
  return out;
}

function applyCustomFilters(
  text: string,
  preset: TextFilterPreset,
): { output: string; warnings: string[] } {
  const warnings: string[] = [];
  let out = text;
  for (const rule of preset.custom) {
    if (!rule.enabled) continue;
    const pat = rule.pattern.trim();
    if (!pat) continue;
    try {
      const flags = rule.flags?.trim() || "g";
      const re = new RegExp(pat, flags);
      out = out.replace(re, rule.replacement ?? "");
    } catch (e) {
      warnings.push(`${rule.name}: ${String(e)}`);
    }
  }
  return { output: out, warnings };
}

export function applyTextFilters(
  input: string,
  preset: TextFilterPreset,
  sessionOverrides?: BuiltinFilterOverrides | null,
): ApplyTextFiltersResult {
  const originalLen = input.length;
  const builtins = mergeBuiltinToggles(preset, sessionOverrides);
  let out = applyBuiltinFilters(input, builtins);
  const custom = applyCustomFilters(out, preset);
  out = normalizeWhitespace(custom.output);
  const warnings = custom.warnings;
  return {
    output: out,
    removedChars: Math.max(0, originalLen - out.length),
    warnings,
  };
}

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
