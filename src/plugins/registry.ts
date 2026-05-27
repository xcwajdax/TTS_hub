import type { PluginManifest } from "./types";

/** Built-in plugins shipped with the app (v1). */
export const BUILTIN_PLUGIN_IDS = ["soundboard"] as const;
export type BuiltinPluginId = (typeof BUILTIN_PLUGIN_IDS)[number];

export function isBuiltinPluginId(id: string): id is BuiltinPluginId {
  return (BUILTIN_PLUGIN_IDS as readonly string[]).includes(id);
}

/** Fallback metadata when API is unavailable (browser-only). */
export const BUILTIN_PLUGIN_STUBS: PluginManifest[] = [
  {
    id: "soundboard",
    name: "Soundboard",
    description:
      "Osiem slotów z dźwiękami z historii lub dysku. Panel historii: zakładka i pasek u dołu. Skróty Ctrl+Shift+1–8.",
    version: "1.0.0",
    icon: "grid",
    price: "free",
    builtin: true,
    installed: false,
    enabled: false,
  },
];
