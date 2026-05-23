import { useEffect, useState } from "react";
import type { CustomTextFilter, TextFilterPreset } from "../../lib/textFiltersTypes";
import { newCustomFilter } from "../../lib/textFiltersTypes";

interface Props {
  open: boolean;
  preset: TextFilterPreset;
  onClose: () => void;
  onChange: (preset: TextFilterPreset) => void;
}

export default function CustomFiltersModal({ open, preset, onClose, onChange }: Props) {
  const [draft, setDraft] = useState<TextFilterPreset>(preset);

  useEffect(() => {
    if (open) setDraft(preset);
  }, [open, preset]);

  if (!open) return null;

  const updateRule = (id: string, patch: Partial<CustomTextFilter>) => {
    setDraft((prev) => ({
      ...prev,
      custom: prev.custom.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addRule = () => {
    setDraft((prev) => ({
      ...prev,
      custom: [...prev.custom, newCustomFilter(`Reguła ${prev.custom.length + 1}`)],
    }));
  };

  const removeRule = (id: string) => {
    setDraft((prev) => ({ ...prev, custom: prev.custom.filter((r) => r.id !== id) }));
  };

  const save = () => {
    onChange(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-panel border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-filters-title"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="custom-filters-title" className="text-sm font-semibold">
            Reguły regex — {preset.name}
          </h2>
          <button type="button" className="btn text-xs" onClick={onClose}>
            Anuluj
          </button>
        </header>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {draft.custom.length === 0 && (
            <p className="text-xs text-muted">Brak reguł. Dodaj wzorzec regex, aby usunąć lub zamienić fragmenty tekstu.</p>
          )}
          {draft.custom.map((rule) => (
            <div key={rule.id} className="p-3 rounded border border-border bg-panel2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-violet-500"
                  checked={rule.enabled}
                  onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                />
                <input
                  className="flex-1 bg-panel border border-border rounded px-2 py-1 text-xs"
                  value={rule.name}
                  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                  placeholder="Nazwa"
                />
                <button type="button" className="btn text-xs text-red-400" onClick={() => removeRule(rule.id)}>
                  Usuń
                </button>
              </div>
              <input
                className="w-full bg-panel border border-border rounded px-2 py-1 text-xs font-mono"
                value={rule.pattern}
                onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                placeholder="Wzorzec regex"
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-panel border border-border rounded px-2 py-1 text-xs"
                  value={rule.replacement}
                  onChange={(e) => updateRule(rule.id, { replacement: e.target.value })}
                  placeholder="Zamień na (puste = usuń)"
                />
                <input
                  className="w-16 bg-panel border border-border rounded px-2 py-1 text-xs font-mono"
                  value={rule.flags ?? "g"}
                  onChange={(e) => updateRule(rule.id, { flags: e.target.value })}
                  placeholder="flagi"
                  title="Flagi RegExp, np. gim"
                />
              </div>
            </div>
          ))}
        </div>
        <footer className="flex justify-between gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn text-xs" onClick={addRule}>
            + Dodaj regułę
          </button>
          <button type="button" className="btn-primary text-xs" onClick={save}>
            Zastosuj
          </button>
        </footer>
      </div>
    </div>
  );
}
