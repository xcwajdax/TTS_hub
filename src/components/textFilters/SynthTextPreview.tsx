import { countWords } from "../../lib/textFilters";

interface Props {
  original: string;
  filtered: string;
  warnings: string[];
  collapsed?: boolean;
}

export default function SynthTextPreview({ original, filtered, warnings, collapsed }: Props) {
  const changed = original.trim() !== filtered.trim();
  if (!changed && warnings.length === 0) return null;

  const preview =
    filtered.length > 280 ? `${filtered.slice(0, 279).trim()}…` : filtered;

  return (
    <div
      className={`rounded-lg border border-border bg-panel2/60 text-xs ${
        collapsed ? "p-2" : "p-3"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted mb-1">
        <span className="font-medium text-ink">Tekst do syntezy</span>
        <span>
          {original.length} → {filtered.length} znaków
        </span>
        <span>
          {countWords(original)} → {countWords(filtered)} słów
        </span>
        {warnings.length > 0 && (
          <span className="text-amber-400" title={warnings.join("\n")}>
            {warnings.length} ostrzeż.
          </span>
        )}
      </div>
      {!collapsed && (
        <p className="text-ink/90 leading-relaxed whitespace-pre-wrap break-words">{preview}</p>
      )}
      {filtered.trim().length === 0 && (
        <p className="text-red-400 mt-1">Po filtrach nie zostaje tekst do syntezy.</p>
      )}
    </div>
  );
}
