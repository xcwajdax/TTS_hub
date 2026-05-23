import { LOCAL_API_BASE } from "../api/tauri";

/** Shown when the Vite dev UI is opened outside the Tauri webview (e.g. Cursor Browser). */
export default function BrowserOnlyBanner() {
  return (
    <div
      className="shrink-0 border-b border-amber-700/60 bg-amber-950/90 text-amber-50 px-4 py-2.5 text-sm z-50"
      role="status"
    >
      <p className="font-medium">Podgląd UI — brak backendu Tauri</p>
      <p className="mt-1 text-amber-100/90 leading-snug">
        Adres{" "}
        <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">localhost:1420</code> to
        tylko frontend Vite. Pełna aplikacja działa w oknie desktopowym po{" "}
        <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">npm run tauri dev</code>.
        Integracja Cursor i skrypty mogą używać API{" "}
        <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">{LOCAL_API_BASE}</code> gdy
        TTS Hub jest uruchomiony.
      </p>
    </div>
  );
}
