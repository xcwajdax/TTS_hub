import { useState } from "react";
import {
  discardAllInterrupted,
  discardJob,
  resumeAllInterrupted,
  resumeJob,
} from "../api/tauri";
import { useJobs } from "../context/JobsContext";
import type { Generation } from "../types";

interface Props {
  open: boolean;
  items: Generation[];
  onClose: () => void;
  onChanged: () => void;
  onError: (e: string) => void;
}

function snippet(g: Generation): string {
  const t = (g.title ?? g.text ?? "").trim();
  if (!t) return "(bez tytułu)";
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
}

export default function RecoveryModal({ open, items, onClose, onChanged, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const { trackEnqueued } = useJobs();

  if (!open || items.length === 0) return null;

  const runBulk = async (fn: () => Promise<Generation[] | unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (Array.isArray(result)) {
        for (const g of result as Generation[]) trackEnqueued(g);
      }
      onChanged();
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runOne = async (fn: () => Promise<Generation | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result && typeof result === "object" && "id" in result) {
        trackEnqueued(result as Generation);
      }
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-panel border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 id="recovery-title" className="text-base font-semibold">
              Znaleziono niedokończone generacje ({items.length})
            </h2>
            <p className="text-xs text-muted">
              Program został zamknięty zanim zakończyły się te generacje. Możesz wznowić każdą z nich lub usunąć z kolejki.
            </p>
          </div>
          <button type="button" className="btn text-xs" onClick={onClose} disabled={busy}>
            Zamknij
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {items.map((g) => (
            <div
              key={g.id}
              className="rounded-md border border-border bg-panel2/50 px-3 py-2 flex flex-col gap-1.5"
            >
              <div className="text-sm leading-snug break-words">{snippet(g)}</div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span>{g.model}</span>
                <span>·</span>
                <span>{g.voice}</span>
                {g.attempts > 0 && (
                  <>
                    <span>·</span>
                    <span>prób: {g.attempts}</span>
                  </>
                )}
              </div>
              {g.error && (
                <div className="text-[11px] text-amber-300/90 truncate" title={g.error}>
                  {g.error}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() => void runOne(() => resumeJob(g.id))}
                  disabled={busy}
                >
                  Wznów
                </button>
                <button
                  type="button"
                  className="btn text-xs hover:!bg-red-900/40"
                  onClick={() => void runOne(() => discardJob(g.id))}
                  disabled={busy}
                >
                  Odrzuć
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            className="btn text-sm"
            onClick={onClose}
            disabled={busy}
          >
            Zdecyduję później
          </button>
          <button
            type="button"
            className="btn text-sm hover:!bg-red-900/40"
            onClick={() => void runBulk(() => discardAllInterrupted())}
            disabled={busy}
          >
            Odrzuć wszystkie
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => void runBulk(() => resumeAllInterrupted())}
            disabled={busy}
          >
            {busy ? "Pracuję…" : "Wznów wszystkie"}
          </button>
        </footer>
      </div>
    </div>
  );
}
