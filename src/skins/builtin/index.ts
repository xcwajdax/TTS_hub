import type { SkinManifest } from "../types";
import { validateSkinManifest } from "../types";
import vibelifeJson from "./vibelife.json";
import matrixJson from "./matrix.json";
import matrixCss from "./matrix.css?raw";
import lightZenJson from "./light-zen.json";
import lightZenCss from "./light-zen.css?raw";

export interface BuiltinSkin {
  manifest: SkinManifest;
  cssText?: string;
}

export const BUILTIN_SKIN_IDS = ["vibelife", "matrix", "light-zen"] as const;
export type BuiltinSkinId = (typeof BUILTIN_SKIN_IDS)[number];

export const BUILTIN_SKINS: BuiltinSkin[] = [
  { manifest: validateSkinManifest(vibelifeJson) },
  {
    manifest: validateSkinManifest(matrixJson),
    cssText: matrixCss,
  },
  {
    manifest: validateSkinManifest(lightZenJson),
    cssText: lightZenCss,
  },
];

export function isBuiltinSkinId(id: string): id is BuiltinSkinId {
  return (BUILTIN_SKIN_IDS as readonly string[]).includes(id);
}
