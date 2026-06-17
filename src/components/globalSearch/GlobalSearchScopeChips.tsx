import type { SearchScope } from "../../lib/globalSearch/types";
import { scopeLabel, SEARCH_SCOPES } from "../../lib/globalSearch/match";

interface Props {
  scope: SearchScope;
  onChange: (scope: SearchScope) => void;
}

export default function GlobalSearchScopeChips({ scope, onChange }: Props) {
  return (
    <div className="global-search__scopes" role="tablist" aria-label="Zakres wyszukiwania">
      {SEARCH_SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={scope === s}
          className={`global-search__scope ${scope === s ? "global-search__scope--active" : ""}`}
          onClick={() => onChange(s)}
        >
          {scopeLabel(s)}
        </button>
      ))}
    </div>
  );
}
