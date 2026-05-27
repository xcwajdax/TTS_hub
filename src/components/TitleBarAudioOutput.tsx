import { usePlayback } from "../context/PlaybackContext";
import {
  deviceOptionKey,
  formatDeviceOptionLabel,
} from "../lib/audioOutputDevice";
import Icon from "./Icon";

export default function TitleBarAudioOutput() {
  const {
    outputDeviceId,
    setOutputDeviceId,
    audioOutputDevices,
    audioOutputSupported,
    audioOutputLoading,
    refreshAudioOutputDevices,
    canPickSystemAudioOutput,
    pickSystemAudioOutput,
    audioOutputEnumerationNotice,
    lastSinkError,
  } = usePlayback();

  const hasExplicitDefault = audioOutputDevices.some((d) => d.deviceId === "default");
  const listEmpty = audioOutputDevices.length === 0 && !audioOutputLoading;

  const title =
    lastSinkError ??
    audioOutputEnumerationNotice ??
    (listEmpty
      ? "Lista pusta — kliknij odśwież lub „Wybierz…”. WebView2 wymaga jednorazowego dostępu do mikrofonu, żeby pokazać głośniki."
      : "Wyjście audio — urządzenie odtwarzania TTS");

  return (
    <div
      className={`title-bar__output ${lastSinkError ? "title-bar__output--warn" : ""}`}
      role="group"
      aria-label="Wyjście audio"
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
    >
      <label className="title-bar__output-field">
        <span className="title-bar__output-label">Wyjście</span>
        <select
          value={audioOutputSupported ? outputDeviceId : ""}
          onChange={(e) => setOutputDeviceId(e.currentTarget.value)}
          disabled={
            !audioOutputSupported || (audioOutputLoading && audioOutputDevices.length === 0)
          }
          className="title-bar__output-select"
          aria-label="Urządzenie wyjściowe"
        >
          {!audioOutputSupported ? (
            <option value="">Domyślne</option>
          ) : (
            <>
              {!hasExplicitDefault && <option value="">Domyślne (Windows)</option>}
              {audioOutputDevices.map((d, index) => (
                <option key={deviceOptionKey(d, index)} value={d.deviceId}>
                  {formatDeviceOptionLabel(d)}
                </option>
              ))}
              {audioOutputDevices.length === 0 && !audioOutputLoading && (
                <option value="" disabled>
                  Brak wykrytych wyjść
                </option>
              )}
            </>
          )}
        </select>
      </label>
      {audioOutputSupported && canPickSystemAudioOutput && (
        <button
          type="button"
          className="title-bar__output-pick"
          onClick={() => void pickSystemAudioOutput()}
          disabled={audioOutputLoading}
          title="Wybierz głośnik w oknie systemowym (zalecane, gdy lista jest pusta)"
          aria-label="Wybierz wyjście audio w systemie"
        >
          Wybierz
        </button>
      )}
      {audioOutputSupported && (
        <button
          type="button"
          className="title-bar__output-refresh"
          onClick={() => void refreshAudioOutputDevices(true)}
          disabled={audioOutputLoading}
          title="Odśwież listę urządzeń wyjściowych (wymaga jednorazowego dostępu do mikrofonu)"
          aria-label="Odśwież listę urządzeń wyjściowych"
        >
          <Icon name="reload" size={12} spin={audioOutputLoading} />
        </button>
      )}
    </div>
  );
}
