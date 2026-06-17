import Icon from "../Icon";
import type { GlobalSearchResult } from "../../lib/globalSearch/types";
import { scopeLabel } from "../../lib/globalSearch/match";

interface Props {
  result: GlobalSearchResult;
  selected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function kindLabel(result: GlobalSearchResult): string {
  if (result.kind === "history") return result.scopeLabel;
  if (result.kind === "draft") return "Szkic";
  return result.fileKind === "video" ? "Wideo MP4" : "Audio";
}

function kindIcon(result: GlobalSearchResult): "tab-history" | "copy" | "film" | "music-note" {
  if (result.kind === "history") return "tab-history";
  if (result.kind === "draft") return "copy";
  if (result.fileKind === "video") return "film";
  return "music-note";
}

export default function GlobalSearchResultRow({
  result,
  selected,
  onSelect,
  onMouseEnter,
}: Props) {
  return (
    <button
      type="button"
      className={`global-search__result ${selected ? "global-search__result--selected" : ""}`}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={selected}
    >
      <span className="global-search__result-icon" aria-hidden>
        <Icon name={kindIcon(result)} size={16} />
      </span>
      <span className="global-search__result-body">
        <span className="global-search__result-title">{result.title}</span>
        {result.snippet && (
          <span className="global-search__result-snippet">{result.snippet}</span>
        )}
      </span>
      <span className="global-search__result-badge">{kindLabel(result)}</span>
    </button>
  );
}

export function globalSearchEmptyHint(scope: Parameters<typeof scopeLabel>[0], query: string): string {
  if (query.trim()) return `Brak wyników w zakresie „${scopeLabel(scope)}”.`;
  return "Wpisz frazę lub wybierz ostatnią pozycję z listy.";
}
