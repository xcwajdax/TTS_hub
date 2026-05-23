import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  SHORTCUT_QUICK_PICKS,
  formatShortcutFromKeyboardEvent,
  parseShortcutString,
  shortcutDisplayLabel,
  shortcutKeyParts,
  validateShortcut,
} from "../lib/quickHotkeyPreset";

interface Props {
  value: string;
  onChange: (shortcut: string) => void;
  disabled?: boolean;
  conflictMessage?: string | null;
  label?: string;
}

function KbdChip({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border bg-panel px-2 py-1 text-sm font-semibold text-heading shadow-sm">
      {children}
    </kbd>
  );
}

export default function ShortcutEditor({
  value,
  onChange,
  disabled,
  conflictMessage,
  label = "Skrót klawiszowy",
}: Props) {
  const captureId = useId();
  const captureRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [manual, setManual] = useState(value);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    setManual(value);
  }, [value]);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const formatted = formatShortcutFromKeyboardEvent(e);
      if (formatted) {
        onChange(formatted);
        setManual(formatted);
        setManualError(null);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  useEffect(() => {
    if (recording) captureRef.current?.focus();
  }, [recording]);

  const startRecording = useCallback(() => {
    if (disabled) return;
    setManualError(null);
    setRecording(true);
  }, [disabled]);

  const applyManual = useCallback(() => {
    const parsed = parseShortcutString(manual);
    if (!parsed) {
      setManualError("Niepoprawny skrót. Przykład: F9, Ctrl+Alt+1, Alt+Shift+T");
      return;
    }
    if (!validateShortcut(parsed)) {
      setManualError("Litera lub cyfra wymaga Ctrl, Alt lub Shift (F9–F12 mogą być same).");
      return;
    }
    setManualError(null);
    onChange(parsed);
  }, [manual, onChange]);

  const parts = shortcutKeyParts(value);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-panel2/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
        {value && (
          <button
            type="button"
            className="text-[10px] text-muted hover:text-heading underline"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setManual("");
            }}
          >
            Wyczyść
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
        {parts.length > 0 ? (
          parts.map((p, i) => (
            <span key={`${p}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-muted text-xs">+</span>}
              <KbdChip>{p}</KbdChip>
            </span>
          ))
        ) : (
          <span className="text-sm text-muted italic">Nie ustawiono — wybierz lub nagraj skrót</span>
        )}
      </div>

      {recording ? (
        <div
          ref={captureRef}
          tabIndex={0}
          id={captureId}
          className="rounded-md border-2 border-accent bg-accent/10 px-3 py-4 text-center outline-none ring-2 ring-accent/40"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setRecording(false);
            }
          }}
        >
          <p className="text-sm font-medium text-heading">Naciśnij kombinację klawiszy…</p>
          <p className="text-[11px] text-muted mt-1">
            Np. <KbdChip>F9</KbdChip> albo <KbdChip>Ctrl</KbdChip>+<KbdChip>Alt</KbdChip>+<KbdChip>1</KbdChip> — Esc anuluje
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary text-sm w-full sm:w-auto"
          disabled={disabled}
          onClick={startRecording}
        >
          {value ? "Zmień skrót (nagraj)" : "Nagraj skrót"}
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted">Szybki wybór</span>
        <div className="flex flex-wrap gap-1.5">
          {SHORTCUT_QUICK_PICKS.map((pick) => {
            const active = value.toLowerCase() === pick.toLowerCase();
            return (
              <button
                key={pick}
                type="button"
                disabled={disabled || recording}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  active
                    ? "border-accent bg-accent/20 text-heading"
                    : "border-border bg-panel hover:border-accent/50 text-muted hover:text-heading"
                }`}
                onClick={() => {
                  onChange(pick);
                  setManual(pick);
                  setManualError(null);
                }}
                title={shortcutDisplayLabel(pick)}
              >
                {shortcutDisplayLabel(pick)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted" htmlFor={`${captureId}-manual`}>
          Wpisz ręcznie (opcjonalnie)
        </label>
        <div className="flex gap-2">
          <input
            id={`${captureId}-manual`}
            className="field flex-1 font-mono text-sm"
            value={manual}
            disabled={disabled || recording}
            placeholder="np. F9 lub Ctrl+Alt+1"
            onChange={(e) => {
              setManual(e.target.value);
              setManualError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyManual();
              }
            }}
            onBlur={() => {
              if (manual.trim() && manual !== value) applyManual();
            }}
          />
          <button type="button" className="btn text-xs shrink-0" disabled={disabled || recording} onClick={applyManual}>
            Zastosuj
          </button>
        </div>
        {manualError && <p className="text-[11px] text-red-300">{manualError}</p>}
      </div>

      {conflictMessage && <p className="text-[11px] text-amber-300">{conflictMessage}</p>}
    </section>
  );
}
