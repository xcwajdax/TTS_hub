import { useAppView } from "../../../context/AppViewContext";

function env(name: string): string | null {
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[name];
    return v ? v : null;
  }
  return null;
}

export default function AboutPage() {
  const { onBackToTts } = useAppView();
  const version = env("npm_package_version") ?? "0.1.0";
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">O programie</h2>
        <p className="text-xs text-muted">TTS Hub — desktopowa aplikacja do syntezy mowy.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Wersja</h3>
        <p className="text-sm">
          TTS Hub <code className="text-ink/80">v{version}</code>
        </p>
        <p className="text-[11px] text-muted">
          Licencja rdzenia: MIT. Klucze API providerów są Twoje (BYOK) i nie opuszczają maszyny.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Dokumentacja</h3>
        <ul className="flex flex-col gap-1 text-xs">
          <li>
            <a
              href="https://github.com/xcwajdax/TTS_hub#readme"
              className="underline hover:text-accent2"
              target="_blank"
              rel="noreferrer"
            >
              README na GitHubie
            </a>
          </li>
          <li>
            <a
              href="https://github.com/xcwajdax/TTS_hub/blob/main/docs/QUICK_SETUP.md"
              className="underline hover:text-accent2"
              target="_blank"
              rel="noreferrer"
            >
              Szybka konfiguracja
            </a>
          </li>
          <li>
            <a
              href="https://github.com/xcwajdax/TTS_hub/blob/main/docs/CURSOR_SKILL.md"
              className="underline hover:text-accent2"
              target="_blank"
              rel="noreferrer"
            >
              Integracja z Cursor
            </a>
          </li>
          <li>
            <a
              href="https://github.com/xcwajdax/TTS_hub/blob/main/docs/API.md"
              className="underline hover:text-accent2"
              target="_blank"
              rel="noreferrer"
            >
              Lokalne API HTTP
            </a>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Lokalne API</h3>
        <p className="text-xs">
          <code className="text-ink/80">http://127.0.0.1:8765</code> — działające tylko gdy okno Tauri
          jest otwarte.
        </p>
      </section>

      <div>
        <button type="button" className="btn text-xs" onClick={onBackToTts}>
          ← Wróć do widoku TTS
        </button>
      </div>
    </div>
  );
}
