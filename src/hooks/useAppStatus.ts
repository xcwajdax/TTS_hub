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

    if (!inTauri) {
      setStatus((prev) => ({
        ...prev,
        apiOk,
        build: prev.build ?? { version: "0.1.0", git_hash: null },
      }));
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
