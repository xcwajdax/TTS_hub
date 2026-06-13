interface Props {
  onStart: () => void;
  onDismiss: () => void;
}

export default function OnboardingWelcome({ onStart, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-border bg-bg shadow-xl overflow-hidden"
        role="dialog"
        aria-labelledby="onboarding-welcome-title"
        aria-modal="true"
      >
        <header className="px-5 py-4 border-b border-border">
          <h2 id="onboarding-welcome-title" className="text-base font-semibold">
            Witaj w TTS Hub
          </h2>
          <p className="text-xs text-muted mt-1">
            Krótki przewodnik pomoże Ci skonfigurować providery i poznać główny widok TTS.
          </p>
        </header>

        <div className="px-5 py-4 text-sm text-muted flex flex-col gap-2">
          <p>Przewodnik obejmuje trzy etapy:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Szybka konfiguracja providerów TTS</li>
            <li>Interaktywny tour widoku TTS</li>
            <li>Podsumowanie dokumentacji (README)</li>
          </ol>
          <p className="text-xs mt-1">
            Możesz wrócić do samouczka później z menu <strong className="text-heading">Pomoc → Samouczek…</strong>.
          </p>
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button type="button" className="btn text-xs" onClick={onDismiss}>
            Później
          </button>
          <button type="button" className="btn-primary text-xs" onClick={onStart}>
            Rozpocznij
          </button>
        </footer>
      </div>
    </div>
  );
}
