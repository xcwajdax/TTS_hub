import { isTauriApp } from "../tauriEnv";

let cached: boolean | undefined;

/** Browser-only UI preview with placeholder data (?mock=1 or VITE_MOCK_UI=1). */
export function isMockUiMode(): boolean {
  if (isTauriApp()) return false;
  if (cached !== undefined) return cached;

  const envFlag = import.meta.env.VITE_MOCK_UI;
  if (envFlag === "1" || envFlag === "true") {
    cached = true;
    return true;
  }

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mock")) {
      const value = params.get("mock");
      cached = value === null || value === "" || value === "1" || value === "true";
      return cached;
    }
  }

  cached = false;
  return false;
}
