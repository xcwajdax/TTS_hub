import { usePlayback } from "../context/PlaybackContext";
import AudioOutputSelect from "./AudioOutputSelect";

export default function AudioOutputSettingsPanel() {
  const {
    audioOutputSupported,
    audioOutputEnumerationNotice,
    lastSinkError,
  } = usePlayback();

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-wide text-muted">Wyjście audio</h3>
      <p className="text-[11px] text-muted">
        Urządzenie, na którym odtwarzany jest TTS (głośniki, słuchawki, HDMI, wirtualne wyjścia
        zainstalowane w systemie).
      </p>

      {!audioOutputSupported && (
        <p className="text-[11px] text-amber-200/90">
          Ten build nie obsługuje wyboru wyjścia — zaktualizuj WebView2 Runtime (Chromium 110+).
        </p>
      )}

      <AudioOutputSelect compact={false} />

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
    </section>
  );
}
