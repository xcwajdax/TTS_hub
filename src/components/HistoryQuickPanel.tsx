import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import {
  DEFAULT_QUICK_HISTORY_PAGE_SIZE,
  type TtsVoiceProfile,
} from "../appSettings";
import type { ArchiveFolder, Generation } from "../types";
import { getMockAppSettingsView } from "../lib/mockUi";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { APP_SETTINGS_CHANGED } from "../lib/appSettingsEvents";
import { filterGenerationsByTextQuery } from "../lib/globalSearch/match";
import { openGlobalSearch } from "../lib/globalSearch/events";
import { groupGenerationsByCalendarDay } from "../lib/historyDateGroups";
import GenerationQueuePanel from "./GenerationQueuePanel";
import HistoryQuickItem from "./HistoryQuickItem";

interface Props {
  items: Generation[];
  folders: ArchiveFolder[];
  interrupted: Generation[];
  currentId: string | null;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  onToast?: (message: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

export default function HistoryQuickPanel({
  items,
  folders,
  interrupted,
  currentId,
  onSelect,
  onPlay,
  onChanged,
  onError,
  onToast,
  voiceProfiles: voiceProfilesProp,
}: Props) {
  const [voiceProfilesState, setVoiceProfilesState] = useState<TtsVoiceProfile[]>(
    () => voiceProfilesProp ?? [],
  );
  const [pageSize, setPageSize] = useState(DEFAULT_QUICK_HISTORY_PAGE_SIZE);
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_QUICK_HISTORY_PAGE_SIZE);
  const [textSearch, setTextSearch] = useState("");
  const voiceProfiles = voiceProfilesProp ?? voiceProfilesState;

  const refreshSettings = useCallback(async () => {
    if (isMockUiMode()) {
      const view = getMockAppSettingsView();
      const nextPageSize = view.quick_history_page_size ?? DEFAULT_QUICK_HISTORY_PAGE_SIZE;
      setPageSize(nextPageSize);
      if (!voiceProfilesProp) {
        setVoiceProfilesState(view.voice_profiles ?? []);
      }
      return;
    }
    try {
      const view = await getAppSettings();
      const nextPageSize = view.quick_history_page_size ?? DEFAULT_QUICK_HISTORY_PAGE_SIZE;
      setPageSize(nextPageSize);
      if (!voiceProfilesProp) {
        setVoiceProfilesState(view.voice_profiles ?? []);
      }
    } catch {
      // ignore
    }
  }, [voiceProfilesProp]);

  useEffect(() => {
    void refreshSettings();
    const onChange = () => void refreshSettings();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChange);
    window.addEventListener(APP_SETTINGS_CHANGED, onChange);
    return () => {
      window.removeEventListener(VOICE_PROFILES_CHANGED, onChange);
      window.removeEventListener(APP_SETTINGS_CHANGED, onChange);
    };
  }, [refreshSettings]);

  useEffect(() => {
    setVisibleLimit(pageSize);
  }, [textSearch, pageSize]);

  const filteredItems = useMemo(
    () => filterGenerationsByTextQuery(items, textSearch),
    [items, textSearch],
  );

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit],
  );
  const dayGroups = useMemo(
    () => groupGenerationsByCalendarDay(visibleItems),
    [visibleItems],
  );
  const hasMore = filteredItems.length > visibleLimit;

  return (
    <div
      className="history-quick-panel flex flex-col h-full min-w-0 overflow-hidden bg-panel"
      data-tour="history-panel"
    >
      <div data-tour="queue">
        <GenerationQueuePanel
          interrupted={interrupted}
          onChanged={onChanged}
          onError={onError}
          voiceProfiles={voiceProfiles}
        />
      </div>

      <div className="px-2 py-1.5 border-b border-border shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[10px] uppercase tracking-wide text-muted font-semibold">
            Ostatnie generacje
          </h2>
          <button
            type="button"
            className="history-quick-panel__search-global"
            onClick={() => openGlobalSearch()}
            title="Szukaj wszędzie (Ctrl+K)"
            aria-label="Otwórz globalną wyszukiwarkę"
          >
            Ctrl+K
          </button>
        </div>
        <div className="history-quick-panel__search">
          <input
            type="search"
            className="history-quick-panel__search-input"
            placeholder="Filtruj listę…"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            aria-label="Filtruj ostatnie generacje"
          />
          {textSearch.trim() && (
            <button
              type="button"
              className="history-quick-panel__search-clear"
              onClick={() => setTextSearch("")}
              aria-label="Wyczyść filtr"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto py-1.5 px-0 history-list history-list--compact gap-0">
        {dayGroups.length === 0 ? (
          <p className="p-3 text-xs text-muted text-center">
            {textSearch.trim()
              ? `Brak wyników dla „${textSearch.trim()}”.`
              : "Brak generacji. Wygeneruj coś po lewej lub sprawdź zakładkę Historia."}
          </p>
        ) : (
          dayGroups.map((group) => (
            <section
              key={group.dayKey}
              className="flex flex-col min-w-0 history-list__section gap-0.5"
            >
              <h3 className="history-list__heading">{group.label}</h3>
              {group.items.map((gen) => (
                <HistoryQuickItem
                  key={gen.id}
                  gen={gen}
                  folders={folders}
                  isCurrent={currentId === gen.id}
                  onSelect={onSelect}
                  onPlay={onPlay}
                  onChanged={onChanged}
                  onError={onError}
                  onToast={onToast}
                  voiceProfiles={voiceProfiles}
                />
              ))}
            </section>
          ))
        )}
        {hasMore && (
          <button
            type="button"
            className="btn text-xs w-[calc(100%-1rem)] mx-2 my-2 shrink-0"
            onClick={() =>
              setVisibleLimit((n) => Math.min(n + pageSize, filteredItems.length))
            }
          >
            Załaduj więcej ({visibleLimit} z {filteredItems.length})
          </button>
        )}
      </div>
    </div>
  );
}
