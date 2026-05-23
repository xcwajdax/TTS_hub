import type { ResolvedSkin, SkinManifest } from "./types";
import { resolveTokens, tokenToCssVar } from "./tokens";
import { BUILTIN_SKINS, isBuiltinSkinId } from "./builtin";

export const SKIN_STORAGE_KEY = "tts-hub-active-skin";
export const DEFAULT_SKIN_ID = "vibelife";

const CUSTOM_STYLE_ID = "skin-custom-css";

export function resolveBuiltinSkin(id: string): ResolvedSkin | null {
  const entry = BUILTIN_SKINS.find((s) => s.manifest.id === id);
  if (!entry) return null;
  return {
    manifest: entry.manifest,
    tokens: resolveTokens(entry.manifest),
    cssText: entry.cssText,
    source: "builtin",
  };
}

export function resolveSkinManifest(
  manifest: SkinManifest,
  source: "builtin" | "custom",
  dirPath?: string,
  cssText?: string,
): ResolvedSkin {
  return {
    manifest,
    tokens: resolveTokens(manifest),
    cssText,
    source,
    dirPath,
  };
}

/** Apply tokens and optional CSS to the document. */
export function applyResolvedSkin(skin: ResolvedSkin): void {
  const root = document.documentElement;
  root.dataset.skin = skin.manifest.id;

  for (const [key, value] of Object.entries(skin.tokens)) {
    root.style.setProperty(tokenToCssVar(key), value);
  }

  const iconFilter =
    skin.tokens["icon-filter"] ?? skin.manifest.icons?.filter;
  if (iconFilter) {
    root.style.setProperty("--icon-filter", iconFilter);
  } else {
    root.style.removeProperty("--icon-filter");
  }

  let styleEl = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (skin.cssText?.trim()) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = CUSTOM_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = skin.cssText;
  } else if (styleEl) {
    styleEl.remove();
  }

  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin.manifest.id);
  } catch {
    /* private mode */
  }

  window.dispatchEvent(
    new CustomEvent("tts-hub-skin-change", { detail: { id: skin.manifest.id } }),
  );
}

/** Bootstrap before React paint — uses localStorage only. */
export function bootstrapSkinFromStorage(): void {
  let id = DEFAULT_SKIN_ID;
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && isBuiltinSkinId(stored)) id = stored;
  } catch {
    /* ignore */
  }
  const skin = resolveBuiltinSkin(id) ?? resolveBuiltinSkin(DEFAULT_SKIN_ID)!;
  applyResolvedSkin(skin);
}

export function applySkinById(id: string, resolved?: ResolvedSkin | null): boolean {
  const skin = resolved ?? resolveBuiltinSkin(id);
  if (!skin) return false;
  applyResolvedSkin(skin);
  return true;
}
