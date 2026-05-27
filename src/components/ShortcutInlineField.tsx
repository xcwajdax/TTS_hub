import { useCallback, useEffect, useId, useState } from "react";
import {
  formatShortcutFromKeyboardEvent,
  migrateLegacyShortcut,
  parseShortcutString,
  shortcutDisplayLabel,
  validateShortcut,
} from "../lib/quickHotkeyPreset";

interface Props {
  value: string;
  onChange: (shortcut: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  conflictMessage?: string | null;
}

export default function ShortcutInlineField({
  value,
  onChange,
  disabled,
  label = "Skrót",
  placeholder = "np. F9",
  conflictMessage,
}: Props) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseShortcutString(raw);
      if (!parsed) {
        if (!raw.trim()) {
          setError(null);
          onChange("");
          setDraft("");
          return;
        }
        setError("Niepoprawny skrót");
        return;
      }
      if (!validateShortcut(parsed)) {
        setError("Wymagany modyfikator");
        return;
      }
      const normalized = migrateLegacyShortcut(parsed);
      setError(null);
      onChange(normalized);
      setDraft(normalized);
    },
    [onChange],
  );

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
        commit(formatted);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, commit]);

  const display = value ? shortcutDisplayLabel(value) : "";

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <label htmlFor={inputId} className="text-[10px] text-muted shrink-0 whitespace-nowrap">
          {label}
        </label>
        <input
          id={inputId}
          className={`field flex-1 min-w-0 text-[11px] font-mono py-1 px-1.5 h-7 ${
            recording ? "ring-1 ring-accent border-accent" : ""
          }`}
          value={recording ? "…" : draft || display}
          readOnly={recording}
          disabled={disabled}
          placeholder={placeholder}
          title={display || placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={() => {
            if (!recording && draft !== value) commit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className={`btn text-[10px] px-1.5 py-1 h-7 shrink-0 ${recording ? "btn-primary" : ""}`}
          disabled={disabled}
          title={recording ? "Naciśnij klawisze… (Esc)" : "Nagraj skrót"}
          onClick={() => {
            setError(null);
            setRecording((r) => !r);
          }}
        >
          {recording ? "…" : "⌨"}
        </button>
        {value ? (
          <button
            type="button"
            className="btn text-[10px] px-1 py-1 h-7 shrink-0"
            disabled={disabled}
            title="Wyczyść skrót"
            onClick={() => {
              setDraft("");
              setError(null);
              onChange("");
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {(error || conflictMessage) && (
        <p className="text-[9px] text-red-300/90 truncate" title={error || conflictMessage || ""}>
          {error || conflictMessage}
        </p>
      )}
    </div>
  );
}
