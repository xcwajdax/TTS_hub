import type { SkinManifest, SkinTokens } from "./types";
import { BUILTIN_SKINS } from "./builtin";

/** Default vibelife token values (RGB triplets unless noted). */
export const VIBELIFE_TOKENS: SkinTokens = {
  "color-bg": "15 17 21",
  "color-panel": "23 26 33",
  "color-panel2": "31 35 44",
  "color-border": "42 47 58",
  "color-accent": "124 92 255",
  "color-accent2": "34 211 238",
  "color-muted": "138 147 166",
  "color-text": "230 232 238",
  "color-text-heading": "243 244 247",
  "color-text-muted": "200 204 214",
  "color-bg-deep": "11 13 18",
  "color-code-bg": "26 30 39",
  "color-scrollbar-hover": "58 65 80",
  "color-text-preview": "200 208 224",
  "font-ui":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "glow-accent": "0 0 12px rgb(124 92 255 / 0.25)",
  "glow-current":
    "0 0 0 1px rgb(124 92 255 / 0.45), 0 0 18px rgb(124 92 255 / 0.2)",
  "glow-playing":
    "0 0 0 1px rgb(34 211 238 / 0.65), 0 0 22px rgb(34 211 238 / 0.28)",
  "gradient-primary":
    "linear-gradient(135deg, rgb(124 92 255) 0%, rgb(34 211 238) 100%)",
  "color-accent-soft": "124 92 255 / 0.07",
  "color-blockquote-text": "200 204 214",
  "icon-filter": "brightness(0) invert(0.88)",
};

export function getBuiltinManifest(id: string): SkinManifest | undefined {
  return BUILTIN_SKINS.find((s) => s.manifest.id === id)?.manifest;
}

export function resolveTokens(manifest: SkinManifest): SkinTokens {
  const base =
    manifest.extends && manifest.extends !== manifest.id
      ? resolveTokens(
          getBuiltinManifest(manifest.extends) ?? {
            id: manifest.extends,
            name: manifest.extends,
            version: "0",
            author: "",
            tokens: manifest.extends === "vibelife" ? VIBELIFE_TOKENS : {},
          },
        )
      : { ...VIBELIFE_TOKENS };

  return { ...base, ...(manifest.tokens ?? {}) };
}

export function tokenToCssVar(key: string): string {
  return key.startsWith("--") ? key : `--${key}`;
}
