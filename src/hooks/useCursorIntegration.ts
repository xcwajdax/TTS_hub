import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getAppSettings } from "../api/tauri";
import { isTauriApp } from "../lib/tauriEnv";
import { defaultCursorIntegration, type CursorIntegration } from "../appSettings";
import type { Generation } from "../types";

/** Live cursor_integration settings + latest cursor generation event. */
export function useCursorIntegration() {
  const [cfg, setCfg] = useState<CursorIntegration>(defaultCursorIntegration());
  const [lastCursor, setLastCursor] = useState<Generation | null>(null);

  const reload = async () => {
    try {
      const view = await getAppSettings();
      setCfg(view.cursor_integration ?? defaultCursorIntegration());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isTauriApp()) return;
    void reload();
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;
    let un: UnlistenFn | null = null;
    void listen<Generation>("generation:ready", (e) => {
      if (e.payload?.source === "cursor" || e.payload?.source === "cursor-skill") {
        setLastCursor(e.payload);
      }
    }).then((fn) => {
      un = fn;
    });
    return () => {
      if (un) un();
    };
  }, []);

  return { cfg, lastCursor, reload };
}
