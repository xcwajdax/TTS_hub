import { usePlayback } from "../context/PlaybackContext";
import {
  deviceOptionKey,
  formatDeviceOptionLabel,
} from "../lib/audioOutputDevice";
import Icon from "./Icon";

interface Props {
  compact?: boolean;
  /** Płaski wygląd bez ramek — belka odtwarzania. */
  flat?: boolean;
  className?: string;
}

export default function AudioOutputSelect({
  compact = true,
  flat = false,
  className = "",
}: Props) {
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

  const labelClass = flat
    ? "flex h-8 shrink-0 items-center gap-1 text-muted"
    : `flex h-8 shrink-0 items-center gap-1.5 px-2 rounded-lg border border-border bg-panel2 text-muted ${
        lastSinkError ? "border-amber-600/60" : ""
      }`;

  const selectClass = flat
    ? "text-[10px] bg-transparent px-0 py-0.5 text-foreground cursor-pointer outline-none w-[4.75rem] truncate"
    : "text-[10px] bg-panel border border-border rounded px-1 py-0.5 text-foreground cursor-pointer hover:border-accent focus:border-accent outline-none max-w-[min(280px,45vw)]";

  const refreshClass = flat
    ? "w-7 h-7 shrink-0 flex items-center justify-center text-muted hover:text-accent transition-colors disabled:opacity-40"
    : "w-8 h-8 shrink-0 rounded-lg border border-border bg-panel2 flex items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-40";

  if (!audioOutputSupported) {
    return (
      <label
        className={`${labelClass} opacity-60 ${className}`}
        title="Wybór wyjścia wymaga nowszego WebView2 Runtime (Chromium 110+)."
      >
        {compact && <span className="text-[10px] whitespace-nowrap">Wyjście</span>}
        <select
          disabled
          className={selectClass}
          aria-label="Urządzenie wyjściowe (niedostępne)"
        >
          <option>Domyślny</option>
        </select>
      </label>
    );
  }

  const hasExplicitDefault = audioOutputDevices.some((d) => d.deviceId === "default");

  return (
    <div className={`flex shrink-0 items-center gap-0.5 ${className}`}>
      <label
        className={labelClass}
        title={
          lastSinkError ??
          audioOutputEnumerationNotice ??
          "Wszystkie wykryte wyjścia audio w systemie"
        }
      >
        {compact && (
          <span className="text-[10px] whitespace-nowrap">
            {flat ? "Wyj." : compact ? "Wyjście" : "Urządzenie wyjściowe"}
          </span>
        )}
        <select
          value={outputDeviceId}
          onChange={(e) => setOutputDeviceId(e.currentTarget.value)}
          disabled={audioOutputLoading && audioOutputDevices.length === 0}
          className={selectClass}
          aria-label="Urządzenie wyjściowe"
        >
          {!hasExplicitDefault && <option value="">Domyślny</option>}
          {audioOutputDevices.map((d, index) => (
            <option key={deviceOptionKey(d, index)} value={d.deviceId}>
              {formatDeviceOptionLabel(d)}
            </option>
          ))}
          {audioOutputDevices.length === 0 && !audioOutputLoading && (
            <option value="" disabled>
              Brak wyjść
            </option>
          )}
        </select>
      </label>
      {canPickSystemAudioOutput && !flat && (
        <button
          type="button"
          className="h-8 shrink-0 px-2 rounded-lg border border-border bg-panel2 text-[10px] text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-40 whitespace-nowrap"
          onClick={() => void pickSystemAudioOutput()}
          disabled={audioOutputLoading}
          title="Otwórz systemowy wybór wyjścia audio (pokaże też urządzenia spoza listy)"
        >
          System…
        </button>
      )}
      <button
        type="button"
        className={refreshClass}
        onClick={() => void refreshAudioOutputDevices(true)}
        disabled={audioOutputLoading}
        title="Odśwież listę wszystkich urządzeń wyjściowych"
        aria-label="Odśwież listę urządzeń wyjściowych"
      >
        <Icon name="reload" size={14} spin={audioOutputLoading} />
      </button>
    </div>
  );
}
