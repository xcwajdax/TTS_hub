import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { revealInExplorer } from "../../api/tauri";
import { FACTORY_PRESET_IDS } from "../../lib/filterPresetCatalog";
import { loadEditorTabs } from "../../lib/editorTabs/persistence";
import { activateEditorTab } from "../../lib/editorTextLoad";
import { runGlobalSearch } from "../../lib/globalSearch/match";
import type { SearchScope, GlobalSearchResult } from "../../lib/globalSearch/types";
import { listVideoExports } from "../../lib/videoTemplates";
import type { Generation } from "../../types";
import type { AppView } from "../AppViewTabs";
import type { HistoryScopeTab } from "../../lib/historyToolbar";
import GlobalSearchResultRow, { globalSearchEmptyHint } from "./GlobalSearchResultRow";
import GlobalSearchScopeChips from "./GlobalSearchScopeChips";

interface Props {
  open: boolean;
  onClose: () => void;
  session: Generation[];
  archive: Generation[];
  cursorFeed: Generation[];
  botsFeed: Generation[];
  onSelectHistory: (g: Generation, play: boolean) => void;
  onGoToView: (view: AppView) => void;
  onGoToHistoryScope: (scope: HistoryScopeTab) => void;
  onError: (msg: string) => void;
}

const DEFAULT_FILTER_PRESET = FACTORY_PRESET_IDS[0];

export default function GlobalSearchModal({
  open,
  onClose,
  session,
  archive,
  cursorFeed,
  botsFeed,
  onSelectHistory,
  onGoToView,
  onGoToHistoryScope,
  onError,
}: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [videoExports, setVideoExports] = useState<Awaited<ReturnType<typeof listVideoExports>>>([]);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const drafts = useMemo(
    () => (open ? loadEditorTabs(DEFAULT_FILTER_PRESET).tabs : []),
    [open],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setScope("all");
    setSelectedIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingVideo(true);
    void listVideoExports(500, 0)
      .then((list) => {
        if (!cancelled) setVideoExports(list);
      })
      .catch((e) => {
        if (!cancelled) onError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingVideo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, onError]);

  const results = useMemo(
    () =>
      runGlobalSearch({
        query,
        scope,
        session,
        archive,
        cursorFeed,
        botsFeed,
        drafts,
        videoExports,
      }),
    [query, scope, session, archive, cursorFeed, botsFeed, drafts, videoExports],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `.global-search__result--selected`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open, results.length]);

  const activateResult = useCallback(
    (result: GlobalSearchResult, play = false) => {
      if (result.kind === "history") {
        onGoToView("tts");
        onSelectHistory(result.generation, play);
        onClose();
        return;
      }

      if (result.kind === "draft") {
        onGoToView("tts");
        activateEditorTab(result.tab.id);
        onClose();
        return;
      }

      if (result.generationId) {
        const pools = [...session, ...archive, ...cursorFeed, ...botsFeed];
        const gen = pools.find((g) => g.id === result.generationId);
        if (gen) {
          onGoToView("tts");
          onSelectHistory(gen, play);
          onClose();
          return;
        }
      }

      if (result.fileKind === "video" && result.videoExportId) {
        onGoToView("history");
        onGoToHistoryScope("video");
        onClose();
        return;
      }

      void revealInExplorer(result.path).catch((e) => onError(String(e)));
      onClose();
    },
    [
      archive,
      botsFeed,
      cursorFeed,
      onClose,
      onError,
      onGoToHistoryScope,
      onGoToView,
      onSelectHistory,
      session,
    ],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      const hit = results[selectedIndex];
      if (hit) activateResult(hit, e.shiftKey);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const idx = SEARCH_SCOPE_INDEX.indexOf(scope);
      const next = e.shiftKey
        ? SEARCH_SCOPE_INDEX[(idx - 1 + SEARCH_SCOPE_INDEX.length) % SEARCH_SCOPE_INDEX.length]
        : SEARCH_SCOPE_INDEX[(idx + 1) % SEARCH_SCOPE_INDEX.length];
      setScope(next);
    }
  };

  if (!open) return null;

  return (
    <div
      className="global-search-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="global-search-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Wyszukiwarka"
        onKeyDown={onKeyDown}
      >
        <div className="global-search__input-wrap">
          <svg
            className="global-search__input-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden
          >
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="global-search__input"
            placeholder="Szukaj w historii, szkicach i plikach…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Fraza wyszukiwania"
          />
          <kbd className="global-search__kbd">Esc</kbd>
        </div>

        <GlobalSearchScopeChips scope={scope} onChange={setScope} />

        <div
          ref={listRef}
          className="global-search__results"
          role="listbox"
          aria-label="Wyniki wyszukiwania"
        >
          {loadingVideo && results.length === 0 && (
            <p className="global-search__empty">Ładowanie biblioteki wideo…</p>
          )}
          {!loadingVideo && results.length === 0 && (
            <p className="global-search__empty">{globalSearchEmptyHint(scope, query)}</p>
          )}
          {results.map((result, index) => (
            <GlobalSearchResultRow
              key={result.id}
              result={result}
              selected={index === selectedIndex}
              onSelect={() => activateResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            />
          ))}
        </div>

        <footer className="global-search__footer">
          <span>↑↓ nawigacja</span>
          <span>Enter otwórz</span>
          <span>Shift+Enter odtwórz</span>
          <span>Tab zakres</span>
        </footer>
      </div>
    </div>
  );
}

const SEARCH_SCOPE_INDEX: SearchScope[] = ["all", "history", "drafts", "files"];
