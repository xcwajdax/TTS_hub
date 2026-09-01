import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActiveVoiceContext } from "../../lib/activeVoiceContext";
import type { SettingsTabId } from "../settings/settingsTabs";

const HOVER_OPEN_MS = 250;
const HOVER_CLOSE_MS = 150;

interface Props {
  context: ActiveVoiceContext;
  onOpenSettings: (tab: SettingsTabId) => void;
  children: ReactNode;
}

export default function ActiveVoiceContextPopover({
  context,
  onOpenSettings,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const open = pinned || hoverOpen;

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setHoverOpen(true), HOVER_OPEN_MS);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    if (pinned) return;
    closeTimerRef.current = setTimeout(() => setHoverOpen(false), HOVER_CLOSE_MS);
  }, [clearTimers, pinned]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setHoverOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
        setHoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pinned]);

  const onTriggerClick = () => {
    clearTimers();
    setPinned((v) => {
      const next = !v;
      if (next) setHoverOpen(true);
      else setHoverOpen(false);
      return next;
    });
  };

  return (
    <div
      ref={rootRef}
      className="active-voice-context relative shrink-0 min-w-0"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`active-voice-context__trigger flex items-center gap-2 min-w-0 text-left rounded-sm hover:bg-panel2/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent2 ${pinned ? "bg-panel2/40" : ""}`.trim()}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Kontekst syntezy — najechanie lub kliknięcie"
        onClick={onTriggerClick}
      >
        {children}
      </button>

      {open && (
        <div
          className="active-voice-context__panel absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded border border-border bg-panel shadow-lg"
          role="dialog"
          aria-label="Kontekst syntezy"
          onMouseEnter={() => {
            clearTimers();
            setHoverOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          <div className="px-3 py-2 border-b border-border/60">
            <div className="text-xs font-semibold text-heading truncate">
              {context.profileName}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{context.barMetaLine}</div>
          </div>

          <dl className="px-3 py-2 space-y-1.5 max-h-[min(16rem,50vh)] overflow-y-auto scrollbar-thin">
            {context.cardRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-2 text-[11px]">
                <dt className="text-muted shrink-0">{row.label}</dt>
                <dd
                  className={`min-w-0 truncate ${row.muted ? "text-muted/70 italic" : "text-ink"}`}
                  title={row.value}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted">
              {pinned ? "Przypięte — Esc lub klik poza" : "Kliknij, aby przypiąć"}
            </span>
            <button
              type="button"
              className="text-[10px] text-accent2 hover:text-ink shrink-0"
              onClick={() => onOpenSettings("voice_profiles")}
            >
              Profile głosu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
