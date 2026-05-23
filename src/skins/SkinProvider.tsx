import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAppSettings, listCustomSkins, readCustomSkin } from "../api/tauri";
import {
  applyResolvedSkin,
  applySkinById,
  DEFAULT_SKIN_ID,
  resolveBuiltinSkin,
  resolveSkinManifest,
} from "./applySkin";
import { BUILTIN_SKINS } from "./builtin";
import type { ResolvedSkin, SkinListEntry, SkinTokens } from "./types";
import { isTauriApp } from "../lib/tauriEnv";
import { validateSkinManifest } from "./types";

interface SkinContextValue {
  activeSkinId: string;
  availableSkins: SkinListEntry[];
  resolved: ResolvedSkin | null;
  loading: boolean;
  setSkin: (id: string) => Promise<boolean>;
  refreshSkins: () => Promise<void>;
}

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const [activeSkinId, setActiveSkinId] = useState(
    () => document.documentElement.dataset.skin ?? DEFAULT_SKIN_ID,
  );
  const [customEntries, setCustomEntries] = useState<SkinListEntry[]>([]);
  const [resolved, setResolved] = useState<ResolvedSkin | null>(() =>
    resolveBuiltinSkin(activeSkinId),
  );
  const [loading, setLoading] = useState(true);

  const builtinEntries: SkinListEntry[] = useMemo(
    () =>
      BUILTIN_SKINS.map((s) => ({
        id: s.manifest.id,
        name: s.manifest.name,
        version: s.manifest.version,
        author: s.manifest.author,
        source: "builtin" as const,
      })),
    [],
  );

  const availableSkins = useMemo(
    () => [...builtinEntries, ...customEntries],
    [builtinEntries, customEntries],
  );

  const refreshSkins = useCallback(async () => {
    try {
      const custom = await listCustomSkins();
      setCustomEntries(custom);
    } catch {
      setCustomEntries([]);
    }
  }, []);

  const applySkinResolved = useCallback((skin: ResolvedSkin) => {
    applyResolvedSkin(skin);
    setActiveSkinId(skin.manifest.id);
    setResolved(skin);
  }, []);

  const setSkin = useCallback(
    async (id: string): Promise<boolean> => {
      const builtin = resolveBuiltinSkin(id);
      if (builtin) {
        applySkinResolved(builtin);
        return true;
      }
      try {
        const loaded = await readCustomSkin(id);
        const manifest = validateSkinManifest({
          ...loaded.manifest,
          tokens: loaded.manifest.tokens as SkinTokens | undefined,
        });
        const skin = resolveSkinManifest(manifest, "custom", loaded.dir_path, loaded.css_text);
        applySkinResolved(skin);
        return true;
      } catch {
        return false;
      }
    },
    [applySkinResolved],
  );

  /** Load skin from app settings once — do not re-run when user picks a skin (would revert unsaved choice). */
  const syncFromSettings = useCallback(async () => {
    setLoading(true);
    try {
      if (!isTauriApp()) {
        let id = DEFAULT_SKIN_ID;
        try {
          const stored = localStorage.getItem("tts-hub-active-skin");
          if (stored?.trim()) id = stored.trim();
        } catch {
          /* ignore */
        }
        const fallback = resolveBuiltinSkin(id) ?? resolveBuiltinSkin(DEFAULT_SKIN_ID)!;
        applySkinResolved(fallback);
        return;
      }
      await refreshSkins();
      const view = await getAppSettings();
      const id = view.active_skin_id?.trim() || DEFAULT_SKIN_ID;
      const ok = await setSkin(id);
      if (!ok) {
        const fallback = resolveBuiltinSkin(DEFAULT_SKIN_ID)!;
        applySkinResolved(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshSkins, setSkin, applySkinResolved]);

  useEffect(() => {
    void syncFromSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const value = useMemo(
    () => ({
      activeSkinId,
      availableSkins,
      resolved,
      loading,
      setSkin,
      refreshSkins,
    }),
    [activeSkinId, availableSkins, resolved, loading, setSkin, refreshSkins],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used within SkinProvider");
  return ctx;
}

/** Re-apply builtin skin without full provider (bootstrap). */
export function applySkinIdQuick(id: string): void {
  applySkinById(id);
}
