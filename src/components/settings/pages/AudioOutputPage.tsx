import { usePlayback } from "../../../context/PlaybackContext";
import AudioOutputSelect from "../../AudioOutputSelect";

export default function AudioOutputPage() {
  const {
    audioOutputSupported,
    audioOutputEnumerationNotice,
    lastSinkError,
  } = usePlayback();

  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Wyjście audio</h2>
        <p className="text-xs text-muted">
          Urządzenie, na którym odtwarzany jest TTS. Szybki pick jest też w pasku tytułu okna.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-muted">Aktywne urządzenie</h3>
        <p className="text-[11px] text-muted">
          Wybór dotyczy wszystkich odtwarzań (edytor, historia, szybkie skróty, soundboard).
        </p>
        <AudioOutputSelect compact={false} />
      </section>

      {!audioOutputSupported && (
        <section className="flex flex-col gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-950/20">
          <h3 className="text-xs uppercase tracking-wide text-amber-200/90">WebView2</h3>
          <p className="text-[11px] text-amber-200/90">
            Ten build nie obsługuje wyboru wyjścia — zaktualizuj WebView2 Runtime (Chromium 110+).
          </p>
        </section>
      )}

      {audioOutputEnumerationNotice && (
        <p className="text-[11px] text-amber-200/90" role="status">
          {audioOutputEnumerationNotice}
        </p>
      )}

      {lastSinkError && (
        <p className="text-[11px] text-amber-200/90" role="alert">
          {lastSinkError}
        </p>
      )}
    </div>
  );
}
