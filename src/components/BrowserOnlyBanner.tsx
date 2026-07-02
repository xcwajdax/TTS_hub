import { LOCAL_API_BASE } from "../api/tauri";
import { isMockUiMode } from "../lib/mockUi";

/** Shown when the Vite dev UI is opened outside the Tauri webview (e.g. Cursor Browser). */
export default function BrowserOnlyBanner() {
  const mockMode = isMockUiMode();

  return (
    <div
      className={
        mockMode
          ? "shrink-0 border-b border-sky-700/60 bg-sky-950/90 text-sky-50 px-4 py-2.5 text-sm z-50"
          : "shrink-0 border-b border-amber-700/60 bg-amber-950/90 text-amber-50 px-4 py-2.5 text-sm z-50"
      }
      role="status"
    >
      {mockMode ? (
        <>
          <p className="font-medium">Tryb mockup — dane przykładowe</p>
          <p className="mt-1 text-sky-100/90 leading-snug">
            Historia, profile głosów i layout są wypełnione placeholderami. Generowanie TTS i
            odtwarzanie audio są wyłączone. Pełna aplikacja:{" "}
            <code className="rounded bg-sky-900/60 px-1 py-0.5 text-xs">npm run tauri dev</code>.
            Wyłącz mockup usuwając{" "}
            <code className="rounded bg-sky-900/60 px-1 py-0.5 text-xs">?mock=1</code> z adresu.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Podgląd UI — brak backendu Tauri</p>
          <p className="mt-1 text-amber-100/90 leading-snug">
            Adres{" "}
            <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">localhost:1420</code> to
            tylko frontend Vite. Pełna aplikacja działa w oknie desktopowym po{" "}
            <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">npm run tauri dev</code>.
            Podgląd z placeholderami: dodaj{" "}
            <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">?mock=1</code> do adresu
            lub uruchom{" "}
            <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">npm run dev:mock</code>.
            Integracja Cursor i skrypty mogą używać API{" "}
            <code className="rounded bg-amber-900/60 px-1 py-0.5 text-xs">{LOCAL_API_BASE}</code>{" "}
            gdy TTS Hub jest uruchomiony.
          </p>
        </>
      )}
    </div>
  );
}
