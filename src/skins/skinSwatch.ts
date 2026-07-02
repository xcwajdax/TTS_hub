import { BUILTIN_SKINS } from "./builtin";
import { resolveTokens } from "./tokens";

export const SKIN_SHORT_LABELS: Record<string, string> = {
  vibelife: "VIBELIFE",
  matrix: "Matrix",
  "light-zen": "Light",
};

export function skinSwatchRgb(skinId: string, tokenKey: string): string {
  const builtin = BUILTIN_SKINS.find((s) => s.manifest.id === skinId);
  const tokens = builtin ? resolveTokens(builtin.manifest) : {};
  const v = tokens[tokenKey];
  if (!v || v.includes("gradient") || v.includes("linear")) {
    return `rgb(${tokens["color-bg"] ?? "0 0 0"})`;
  }
  return `rgb(${v})`;
}
