import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function clampMenuPosition(
  anchor: DOMRect,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  const pad = 8;
  let left = anchor.left;
  let top = anchor.bottom + 4;
  if (left + menuWidth > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - menuWidth - pad);
  }
  if (top + menuHeight > window.innerHeight - pad) {
    top = Math.max(pad, anchor.top - menuHeight - 4);
  }
  return { left, top };
}

function FlatAudioOutputPicker({ className = "" }: { className?: string }) {
  const {
    outputDeviceId,
    setOutputDeviceId,
    audioOutputDevices,
    audioOutputSupported,
    audioOutputLoading,
    refreshAudioOutputDevices,
    audioOutputEnumerationNotice,
    lastSinkError,
  } = usePlayback();

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasExplicitDefault = audioOutputDevices.some((d) => d.deviceId === "default");

  const currentLabel = useMemo(() => {
    if (!audioOutputSupported) return "Domyślny";
    if (!outputDeviceId) return "Domyślny";
    const hit = audioOutputDevices.find((d) => d.deviceId === outputDeviceId);
    return hit ? formatDeviceOptionLabel(hit) : "Domyślny";
  }, [audioOutputDevices, audioOutputSupported, outputDeviceId]);

  const title =
    lastSinkError ??
    audioOutputEnumerationNotice ??
    "Wszystkie wykryte wyjścia audio w systemie";

  const close = useCallback(() => setOpen(false), []);

  const openMenu = () => {
    if (!audioOutputSupported || audioOutputLoading) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos(clampMenuPosition(rect, 180, 220));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!el || !rect) return;
    setMenuPos(clampMenuPosition(rect, el.offsetWidth, el.offsetHeight));
  }, [open, audioOutputDevices.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      const menu = menuRef.current;
      const trigger = triggerRef.current;
      if (menu?.contains(e.target as Node) || trigger?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [close, open]);

  const pickDevice = (deviceId: string) => {
    setOutputDeviceId(deviceId);
    close();
  };

  return (
    <div className={`playback-output-picker flex shrink-0 items-stretch gap-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="playback-output-picker__trigger chrome-field chrome-field--narrow"
        onClick={() => (open ? close() : openMenu())}
        disabled={!audioOutputSupported || (audioOutputLoading && audioOutputDevices.length === 0)}
        title={title}
        aria-label="Urządzenie wyjściowe"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-[10px] text-muted shrink-0">Wyj.</span>
        <span className="playback-output-picker__value truncate text-[10px] text-foreground">
          {currentLabel}
        </span>
        <Icon name="chevron-down" size={12} className="shrink-0 opacity-70" />
      </button>

      <button
        type="button"
        className="playback-output-picker__refresh"
        onClick={() => void refreshAudioOutputDevices(true)}
        disabled={audioOutputLoading || !audioOutputSupported}
        title="Odśwież listę wszystkich urządzeń wyjściowych"
        aria-label="Odśwież listę urządzeń wyjściowych"
      >
        <Icon name="reload" size={14} spin={audioOutputLoading} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Wybierz urządzenie wyjściowe"
            className="playback-output-picker__menu fixed z-[200] w-[180px] max-w-[min(240px,90vw)] py-1 rounded-lg border border-border bg-panel shadow-lg text-sm"
            style={{ left: menuPos.left, top: menuPos.top }}
          >
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted border-b border-border/80">
              Wyjście audio
            </p>
            {!hasExplicitDefault && (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!outputDeviceId}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors truncate ${
                  !outputDeviceId ? "bg-panel2 text-heading" : "hover:bg-panel2/80 text-foreground"
                }`}
                onClick={() => pickDevice("")}
              >
                Domyślny
              </button>
            )}
            {audioOutputDevices.map((d, index) => {
              const selected = outputDeviceId === d.deviceId;
              return (
                <button
                  key={deviceOptionKey(d, index)}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors truncate ${
                    selected ? "bg-panel2 text-heading" : "hover:bg-panel2/80 text-foreground"
                  }`}
                  title={formatDeviceOptionLabel(d)}
                  onClick={() => pickDevice(d.deviceId)}
                >
                  {formatDeviceOptionLabel(d)}
                </button>
              );
            })}
            {audioOutputDevices.length === 0 && !audioOutputLoading && (
              <p className="px-3 py-2 text-[11px] text-muted">Brak wyjść</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
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

  if (flat) {
    return <FlatAudioOutputPicker className={className} />;
  }

  const labelClass = `flex h-8 shrink-0 items-center gap-1.5 px-2 rounded-lg border border-border bg-panel2 text-muted ${
    lastSinkError ? "border-amber-600/60" : ""
  }`;

  const selectClass =
    "text-[10px] bg-panel border border-border rounded px-1 py-0.5 text-foreground cursor-pointer hover:border-accent focus:border-accent outline-none max-w-[min(280px,45vw)]";

  const refreshClass =
    "w-8 h-8 shrink-0 rounded-lg border border-border bg-panel2 flex items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-40";

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
            {compact ? "Wyjście" : "Urządzenie wyjściowe"}
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
      {canPickSystemAudioOutput && (
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
