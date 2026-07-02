/** Skin manifest v1 — see docs/SKINS.md and docs/skin.schema.json */

import { normalizeSkinPreferences, type SkinPreferences } from "./skinPreferences";
import type { SkinTransitionConfig } from "./transition/types";

export interface SkinRegistryMeta {
  homepage?: string;
  update_url?: string;
  manifest_url?: string;
}

export interface SkinIcons {
  filter?: string;
  variant?: string;
}

/** Token keys map to CSS custom properties: --{key} */
export type SkinTokens = Record<string, string>;

export interface SkinManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  extends?: string;
  tokens?: SkinTokens;
  /** Relative path inside skin folder (custom skins) */
  css?: string;
  icons?: SkinIcons;
  registry?: SkinRegistryMeta;
  /** Non-CSS defaults (e.g. timeline_view) applied when skin is activated. */
  preferences?: SkinPreferences;
  /** Wave transition when switching to this skin (see docs/SKINS.md). */
  transition?: Partial<SkinTransitionConfig>;
}

export interface ResolvedSkin {
  manifest: SkinManifest;
  tokens: SkinTokens;
  /** Inline CSS (builtin) or loaded from disk */
  cssText?: string;
  source: "builtin" | "custom";
  dirPath?: string;
}

export interface SkinListEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  source: "builtin" | "custom";
  dir_path?: string;
}

export interface RemoteSkinEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  download_url?: string;
  preview_url?: string;
}

const REQUIRED = ["id", "name", "version", "author"] as const;

export function validateSkinManifest(raw: unknown): SkinManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("skin.json: oczekiwany obiekt JSON");
  }
  const m = raw as Record<string, unknown>;
  for (const key of REQUIRED) {
    const v = m[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`skin.json: brak lub pusty "${key}"`);
    }
  }
  const id = (m.id as string).trim();
  if (!/^[a-z][a-z0-9_-]*$/.test(id)) {
    throw new Error(`skin.json: nieprawidłowe id "${id}"`);
  }
  if (m.extends !== undefined && typeof m.extends !== "string") {
    throw new Error('skin.json: "extends" musi być stringiem');
  }
  if (m.tokens !== undefined) {
    if (typeof m.tokens !== "object" || m.tokens === null || Array.isArray(m.tokens)) {
      throw new Error('skin.json: "tokens" musi być obiektem');
    }
    for (const [k, v] of Object.entries(m.tokens as Record<string, unknown>)) {
      if (typeof v !== "string") {
        throw new Error(`skin.json: token "${k}" musi być stringiem`);
      }
    }
  }
  if (m.preferences !== undefined) {
    if (typeof m.preferences !== "object" || m.preferences === null || Array.isArray(m.preferences)) {
      throw new Error('skin.json: "preferences" musi być obiektem');
    }
    const tv = (m.preferences as Record<string, unknown>).timeline_view;
    if (tv !== undefined && typeof tv !== "string") {
      throw new Error('skin.json: preferences.timeline_view musi być stringiem');
    }
  }

  return {
    id,
    name: (m.name as string).trim(),
    version: (m.version as string).trim(),
    author: (m.author as string).trim(),
    extends: typeof m.extends === "string" ? m.extends.trim() || undefined : undefined,
    tokens: (m.tokens as SkinTokens) ?? undefined,
    css: typeof m.css === "string" ? m.css.trim() || undefined : undefined,
    icons: m.icons as SkinIcons | undefined,
    registry: m.registry as SkinRegistryMeta | undefined,
    preferences: normalizeSkinPreferences(m.preferences),
  };
}
