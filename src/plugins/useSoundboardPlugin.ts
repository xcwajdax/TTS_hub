import { useCallback, useEffect, useState } from "react";
import { getPlugins } from "../api/tauri";
import { MOCK_PLUGINS } from "../lib/mockUi";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { isTauriApp } from "../lib/tauriEnv";
import type { PluginManifest } from "./types";
import { PLUGINS_CHANGED } from "./events";

export function useSoundboardPlugin() {
  const [plugin, setPlugin] = useState<PluginManifest | null>(null);

  const refresh = useCallback(async () => {
    if (isMockUiMode()) {
      setPlugin(MOCK_PLUGINS.find((p) => p.id === "soundboard") ?? null);
      return;
    }
    if (!isTauriApp()) {
      setPlugin(null);
      return;
    }
    try {
      const list = await getPlugins();
      setPlugin(list.find((p) => p.id === "soundboard") ?? null);
    } catch {
      setPlugin(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(PLUGINS_CHANGED, onChange);
    return () => window.removeEventListener(PLUGINS_CHANGED, onChange);
  }, [refresh]);

  return {
    plugin,
    installed: plugin?.installed ?? false,
    enabled: plugin?.enabled ?? false,
    refresh,
  };
}
