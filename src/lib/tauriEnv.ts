import { isTauri } from "@tauri-apps/api/core";

/** True when running inside the Tauri desktop webview (not a plain browser). */
export function isTauriApp(): boolean {
  return isTauri();
}
