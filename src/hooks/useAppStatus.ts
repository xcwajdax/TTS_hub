import { useCallback, useEffect, useState } from "react";
import {
  getAppBuildInfo,
  getCursorIntegrationStatus,
  getMcpIntegrationStatus,
  LOCAL_API_BASE,
  minimaxHealth,
  voiceboxHealth,
} from "../api/tauri";
import type {
  AppBuildInfo,
  CursorIntegrationStatus,
  McpIntegrationStatus,
} from "../appSettings";
import type { MinimaxHealth, VoiceBoxHealth } from "../api/tauri";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { isTauriApp } from "../lib/tauriEnv";

const POLL_MS = 10_000;

export interface AppStatusSnapshot {
  apiOk: boolean | null;
  mcp: McpIntegrationStatus | null;
  cursor: CursorIntegrationStatus | null;
  voicebox: VoiceBoxHealth | null;
  minimax: MinimaxHealth | null;
  build: AppBuildInfo | null;
}

const INITIAL: AppStatusSnapshot = {
  apiOk: null,
  mcp: null,
  cursor: null,
  voicebox: null,
  minimax: null,
  build: null,
};

export function useAppStatus(): AppStatusSnapshot {
  const [status, setStatus] = useState<AppStatusSnapshot>(INITIAL);
  const inTauri = isTauriApp();

  const refresh = useCallback(async () => {
    let apiOk: boolean | null = null;
    try {
      const res = await fetch(`${LOCAL_API_BASE}/health`, { cache: "no-store" });
      apiOk = res.ok;
    } catch {
      apiOk = false;
    }

    if (!inTauri && !isMockUiMode()) {
      setStatus((prev) => ({
        ...prev,
        apiOk,
        build: prev.build ?? { version: "0.1.0", git_hash: null },
      }));
      return;
    }

    if (isMockUiMode()) {
      setStatus({
        apiOk,
        mcp: { configured: true, config_path: "~/.cursor/mcp.json (mock)", scope: "global" },
        cursor: {
          api_ok: false,
          hooks_installed: true,
          ps1_path: ".cursor-hooks/cursor-tts.ps1 (mock)",
          hooks_json_path: ".cursor/hooks.json (mock)",
          tts_hub_config_path: ".cursor/tts-hub.json (mock)",
          pwsh_available: true,
          last_install_ts: Date.now(),
          last_cursor_at: Date.now() - 60_000,
        },
        voicebox: {
          status: "ok",
          model_loaded: true,
          model_downloaded: true,
          model_size: "mock",
          gpu_available: false,
          gpu_type: null,
          vram_used_mb: null,
          backend_type: "mock",
          backend_variant: null,
          gpu_compatibility_warning: null,
        },
        minimax: { configured: true, ok: true, message: "Mock" },
        build: { version: "0.1.0", git_hash: "mock" },
      });
      return;
    }

    const [mcp, cursor, voicebox, minimax, build] = await Promise.all([
      getMcpIntegrationStatus().catch(() => null),
      getCursorIntegrationStatus().catch(() => null),
      voiceboxHealth().catch(() => null),
      minimaxHealth().catch(() => null),
      getAppBuildInfo().catch(() => null),
    ]);

    setStatus({
      apiOk,
      mcp,
      cursor,
      voicebox,
      minimax,
      build,
    });
  }, [inTauri]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return status;
}
