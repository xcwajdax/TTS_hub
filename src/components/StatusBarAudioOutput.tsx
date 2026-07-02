import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePlayback } from "../context/PlaybackContext";
import {
  deviceOptionKey,
  formatDeviceOptionLabel,
} from "../lib/audioOutputDevice";
import Icon from "./Icon";

function SpeakerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden className="status-bar__audio-icon">
      <path
        fill="currentColor"
        d="M3 10v4h4l5 5V5L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.14-3.82v7.64A4.48 4.48 0 0 0 16.5 12Zm2.14 6.32A7.5 7.5 0 0 0 19.5 12a7.5 7.5 0 0 0-0.86-6.32v12.64Z"
      />
    </svg>
  );
}

function clampMenuPosition(
  anchor: DOMRect,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  const pad = 8;
  let left = anchor.left;
  let top = anchor.top - menuHeight - 4;
  if (left + menuWidth > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - menuWidth - pad);
  }
  if (top < pad) {
    top = anchor.bottom + 4;
  }
  return { left, top };
}

export default function StatusBarAudioOutput() {
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

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const hasExplicitDefault = audioOutputDevices.some((d) => d.deviceId === "default");

  const currentLabel = useMemo(() => {
    if (!audioOutputSupported) return "Domyślne";
    if (!outputDeviceId) return "Domyślne";
    const hit = audioOutputDevices.find((d) => d.deviceId === outputDeviceId);
    return hit ? formatDeviceOptionLabel(hit) : "Domyślne";
  }, [audioOutputDevices, audioOutputSupported, outputDeviceId]);

  const title =
    lastSinkError ??
    audioOutputEnumerationNotice ??
    "Globalne wyjście audio — urządzenie odtwarzania TTS";

  const close = useCallback(() => setOpen(false), []);

  const openMenu = () => {
    if (!audioOutputSupported || audioOutputLoading) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos(clampMenuPosition(rect, 200, 240));
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
      const group = groupRef.current;
      if (menu?.contains(e.target as Node) || group?.contains(e.target as Node)) return;
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
    <div
      ref={groupRef}
      className={`status-bar__chrome status-bar__audio ${lastSinkError ? "status-bar__audio--warn" : ""}`}
      role="group"
      aria-label="Wyjście audio"
      title={title}
    >
      <button
        ref={triggerRef}
        type="button"
        className="status-bar__audio-trigger"
        onClick={() => (open ? close() : openMenu())}
        disabled={!audioOutputSupported || (audioOutputLoading && audioOutputDevices.length === 0)}
        aria-label={`Wyjście audio: ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SpeakerIcon />
        <span className="status-bar__audio-label">{currentLabel}</span>
        <Icon name="chevron-down" size={10} className="status-bar__audio-chevron" />
      </button>

      {canPickSystemAudioOutput && (
        <button
          type="button"
          className="status-bar__audio-pick"
          onClick={() => void pickSystemAudioOutput()}
          disabled={audioOutputLoading || !audioOutputSupported}
          title="Wybierz głośnik w oknie systemowym"
          aria-label="Wybierz wyjście audio w systemie"
        >
          <Icon name="clip-external" size={11} />
        </button>
      )}

      <button
        type="button"
        className="status-bar__audio-refresh"
        onClick={() => void refreshAudioOutputDevices(true)}
        disabled={audioOutputLoading || !audioOutputSupported}
        title="Odśwież listę urządzeń wyjściowych"
        aria-label="Odśwież listę urządzeń wyjściowych"
      >
        <Icon name="reload" size={12} spin={audioOutputLoading} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Wybierz urządzenie wyjściowe"
            className="status-bar__audio-menu"
            style={{ left: menuPos.left, top: menuPos.top }}
          >
            <p className="status-bar__audio-menu-title">Wyjście audio</p>
            {!hasExplicitDefault && (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!outputDeviceId}
                className={`status-bar__audio-menu-item ${!outputDeviceId ? "status-bar__audio-menu-item--active" : ""}`}
                onClick={() => pickDevice("")}
              >
                Domyślne
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
                  className={`status-bar__audio-menu-item ${selected ? "status-bar__audio-menu-item--active" : ""}`}
                  title={formatDeviceOptionLabel(d)}
                  onClick={() => pickDevice(d.deviceId)}
                >
                  {formatDeviceOptionLabel(d)}
                </button>
              );
            })}
            {audioOutputDevices.length === 0 && !audioOutputLoading && (
              <p className="status-bar__audio-menu-empty">Brak wykrytych wyjść</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
