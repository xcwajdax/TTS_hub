import { useEffect, useState } from "react";
import { countWords } from "../../lib/textFilters";
import {
  FACTORY_VOICEOVER_BRIEF_ID,
  VOICEOVER_BRIEF_TARGET_WPM,
} from "../../lib/filterPresetCatalog";

const PREVIEW_CHAR_LIMIT = 280;

function formatSpeechDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface Props {
  original: string;
  filtered: string;
  warnings: string[];
  collapsed?: boolean;
  activePresetId?: string | null;
}

export default function SynthTextPreview({
  original,
  filtered,
  warnings,
  collapsed,
  activePresetId,
}: Props) {
  const [textExpanded, setTextExpanded] = useState(false);

  useEffect(() => {
    setTextExpanded(false);
  }, [filtered]);

  const changed = original.trim() !== filtered.trim();
  if (!changed && warnings.length === 0) return null;

  const isTruncatable = filtered.length > PREVIEW_CHAR_LIMIT;
  const displayText =
    textExpanded || !isTruncatable
      ? filtered
      : `${filtered.slice(0, PREVIEW_CHAR_LIMIT - 1).trim()}…`;

  const filteredWords = countWords(filtered);
  const voiceoverBrief = activePresetId === FACTORY_VOICEOVER_BRIEF_ID;
  const estimatedSeconds =
    voiceoverBrief && filteredWords > 0
      ? (filteredWords / VOICEOVER_BRIEF_TARGET_WPM) * 60
      : null;

  return (
    <div
      className={`rounded-lg border border-border bg-panel2/60 text-xs ${
        collapsed ? "p-2" : "p-3"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-muted mb-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <span className="font-medium text-ink">Tekst do syntezy</span>
          <span>
            {original.length} → {filtered.length} znaków
          </span>
          <span>
            {countWords(original)} → {filteredWords} słów
          </span>
          {estimatedSeconds != null && (
            <span title={`Przy ~${VOICEOVER_BRIEF_TARGET_WPM} słów/min`}>
              ~{formatSpeechDuration(estimatedSeconds)} mowy
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-amber-400" title={warnings.join("\n")}>
              {warnings.length} ostrzeż.
            </span>
          )}
        </div>
        {isTruncatable && !collapsed ? (
          <button
            type="button"
            className="text-[11px] text-muted hover:text-heading shrink-0"
            onClick={() => setTextExpanded((v) => !v)}
            aria-expanded={textExpanded}
          >
            {textExpanded ? "Zwiń" : "Rozwiń"}
          </button>
        ) : null}
      </div>
      {!collapsed && (
        <p
          className={`text-ink/90 leading-relaxed whitespace-pre-wrap break-words ${
            textExpanded ? "max-h-48 overflow-y-auto pr-1" : ""
          }`}
        >
          {displayText}
        </p>
      )}
      {filtered.trim().length === 0 && (
        <p className="text-red-400 mt-1">Po filtrach nie zostaje tekst do syntezy.</p>
      )}
    </div>
  );
}
