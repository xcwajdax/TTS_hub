import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_FORMATS } from "../audioFormats";
import {
  getAppSettings,
  getTokenUsage,
  listVoices,
  openQuickSetupWindow,
  syncMinimaxVoices,
  pickArchiveFolderSettings,
  pickTempFolder,
  setAppSettings,
} from "../api/tauri";
import type {
  ApiProfile,
  AppSettings,
  AppSettingsView,
  CursorIntegration,
  SaveMode,
} from "../appSettings";
import {
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_MINIMAX_LANGUAGE,
  DEFAULT_TEMP_HISTORY_MAX,
  MAX_CONCURRENT_JOBS,
  MAX_TEMP_HISTORY_MAX,
  MIN_CONCURRENT_JOBS,
  MIN_TEMP_HISTORY_MAX,
  defaultCursorIntegration,
  defaultEditorQuickGenSettings,
  defaultQuickHotkeysSettings,
  defaultTextFiltersSettings,
  newApiProfile,
  appSettingsViewToPayload,
} from "../appSettings";
import { MINIMAX_LANGUAGE_CATALOG } from "../lib/minimaxLanguages";
import { ensureTextFiltersWithFactory } from "../lib/filterPresetCatalog";
import TextFiltersSettingsPanel from "./textFilters/TextFiltersSettingsPanel";
import {
  loadHistoryClickToPlay,
  loadHistoryCompactView,
  saveHistoryClickToPlay,
  saveHistoryCompactView,
} from "../lib/historyPlaybackPrefs";
import type { AudioFormat, UsageSummary, UsageTotals } from "../types";
import AppearancePanel from "./AppearancePanel";
import CursorIntegrationPanel from "./CursorIntegrationPanel";
import OrganizationSettingsPanel from "./OrganizationSettingsPanel";
import QuickHotkeysPanel from "./QuickHotkeysPanel";
import EditorQuickGenPanel from "./EditorQuickGenPanel";
import { useTimelineView } from "../context/TimelineViewContext";
import { normalizeTimelineViewMode } from "../lib/timelineView";
import { DEFAULT_SKIN_ID } from "../skins/applySkin";
import ClearLocalDataPanel from "./ClearLocalDataPanel";
import AvatarsSettingsPanel from "./avatars/AvatarsSettingsPanel";

type Tab =
  | "general"
  | "usage"
  | "cursor"
  | "appearance"
  | "avatars"
  | "filters"
  | "quick_hotkeys"
  | "organization";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
  initialTab?: Tab;
  onSuccess?: (message: string) => void;
  onOrganizationChanged?: () => void;
  onLocalDataCleared?: () => void;
}

type Draft = AppSettingsView & {
  history_click_to_play: boolean;
  history_compact_view: boolean;
};

export default function AdvancedSettingsModal({
  open,
  onClose,
  onSaved,
  onError,
  initialTab,
  onSuccess,
  onOrganizationChanged,
  onLocalDataCleared,
}: Props) {
  const { setMode: syncTimelineView } = useTimelineView();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [voices, setVoices] = useState<string[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [syncingMinimaxVoices, setSyncingMinimaxVoices] = useState(false);
  const backdropPointerDown = useRef(false);

  const load = useCallback(async () => {
    try {
      const view = await getAppSettings();
      const cursor = view.cursor_integration ?? defaultCursorIntegration();
      setDraft({
        ...view,
        cursor_integration: cursor,
        text_filters: ensureTextFiltersWithFactory(
          view.text_filters ?? defaultTextFiltersSettings(),
        ),
        quick_hotkeys: view.quick_hotkeys ?? defaultQuickHotkeysSettings(),
        editor_quick_gen: view.editor_quick_gen ?? defaultEditorQuickGenSettings(),
        history_click_to_play: loadHistoryClickToPlay(),
        history_compact_view: loadHistoryCompactView(),
      });
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    if (open) {
      void load();
      setEditingProfileId(null);
      setTab(initialTab ?? "general");
      listVoices()
        .then(setVoices)
        .catch(() => setVoices([]));
      getTokenUsage()
        .then(setUsage)
        .catch(() => setUsage(null));
    }
  }, [open, load, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const payload: AppSettings = {
        ...appSettingsViewToPayload(draft),
        cursor_integration: draft.cursor_integration,
        max_concurrent_jobs: draft.max_concurrent_jobs ?? DEFAULT_MAX_CONCURRENT_JOBS,
        active_skin_id: draft.active_skin_id?.trim() || DEFAULT_SKIN_ID,
        text_filters: draft.text_filters ?? defaultTextFiltersSettings(),
        quick_hotkeys: draft.quick_hotkeys ?? defaultQuickHotkeysSettings(),
        editor_quick_gen: draft.editor_quick_gen ?? defaultEditorQuickGenSettings(),
      };
      const view = await setAppSettings(payload);
      await syncTimelineView(normalizeTimelineViewMode(view.timeline_view), { persist: false });
      saveHistoryClickToPlay(draft.history_click_to_play);
      saveHistoryCompactView(draft.history_compact_view);
      setDraft({
        ...view,
        history_click_to_play: draft.history_click_to_play,
        history_compact_view: draft.history_compact_view,
      });
      onSaved();
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const browseTemp = async () => {
    try {
      const picked = await pickTempFolder();
      if (picked) {
        update("temp_path", picked);
        update("effective_temp_path", picked);
      }
    } catch (e) {
      onError(String(e));
    }
  };

  const browseArchive = async () => {
    try {
      const picked = await pickArchiveFolderSettings();
      if (picked) {
        update("archive_path", picked);
        update("effective_archive_path", picked);
      }
    } catch (e) {
      onError(String(e));
    }
  };

  const addProfile = () => {
    const profile = newApiProfile(`Profil ${draft.api_profiles.length + 1}`);
    update("api_profiles", [...draft.api_profiles, profile]);
    update("active_api_id", profile.id);
    setEditingProfileId(profile.id);
  };

  const removeProfile = (id: string) => {
    const next = draft.api_profiles.filter((p) => p.id !== id);
    update("api_profiles", next);
    if (draft.active_api_id === id) {
      update("active_api_id", next[0]?.id ?? null);
    }
    if (editingProfileId === id) setEditingProfileId(null);
  };

  const updateProfile = (id: string, patch: Partial<ApiProfile>) => {
    update(
      "api_profiles",
      draft.api_profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  const closeFromBackdrop = () => {
    if (backdropPointerDown.current) onClose();
    backdropPointerDown.current = false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        backdropPointerDown.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget) closeFromBackdrop();
        else backdropPointerDown.current = false;
      }}
    >
      <div
        className={`w-full max-h-[90vh] flex flex-col bg-panel border border-border rounded-lg shadow-xl overflow-hidden ${
          tab === "quick_hotkeys" ? "max-w-4xl" : "max-w-2xl"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-settings-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 id="advanced-settings-title" className="text-base font-semibold">
              Ustawienia zaawansowane
            </h2>
            <p className="text-xs text-muted">API, ścieżki i tryb zapisu generacji</p>
          </div>
          <button type="button" className="btn text-xs" onClick={onClose}>
            Zamknij
          </button>
        </header>

        <nav className="flex border-b border-border text-sm">
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "general" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("general")}
          >
            Ogólne
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "usage" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("usage")}
          >
            Zużycie
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "cursor" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("cursor")}
          >
            Cursor
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "appearance" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("appearance")}
          >
            Wygląd
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "avatars" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("avatars")}
          >
            Awatary
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "filters" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("filters")}
          >
            Filtry
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "quick_hotkeys" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("quick_hotkeys")}
          >
            Skróty
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "organization" ? "bg-panel2 text-heading border-b-2 border-accent" : "text-muted hover:text-heading"}`}
            onClick={() => setTab("organization")}
          >
            Organizacja
          </button>
        </nav>

        {tab === "usage" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <UsagePanel usage={usage} />
          </div>
        )}

        {tab === "cursor" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <CursorIntegrationPanel
              value={draft.cursor_integration}
              onChange={(next: CursorIntegration) => update("cursor_integration", next)}
              voices={voices}
              onError={onError}
            />
          </div>
        )}

        {tab === "appearance" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <AppearancePanel
              activeSkinId={draft.active_skin_id ?? DEFAULT_SKIN_ID}
              onSelectSkin={(id) => update("active_skin_id", id)}
              timelineView={draft.timeline_view ?? "bars"}
              onTimelineViewChange={(mode) => update("timeline_view", mode)}
              onError={onError}
            />
          </div>
        )}

        {tab === "avatars" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <AvatarsSettingsPanel onError={onError} />
          </div>
        )}

        {tab === "filters" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <TextFiltersSettingsPanel
              value={draft.text_filters ?? defaultTextFiltersSettings()}
              onChange={(next) => update("text_filters", next)}
              onError={onError}
            />
          </div>
        )}

        {tab === "quick_hotkeys" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <QuickHotkeysPanel
              value={draft.quick_hotkeys ?? defaultQuickHotkeysSettings()}
              onChange={(next) => update("quick_hotkeys", next)}
              filterPresets={draft.text_filters?.presets ?? []}
              onError={onError}
              onSuccess={onSuccess}
            />
          </div>
        )}

        {tab === "organization" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <OrganizationSettingsPanel onError={onError} onChanged={onOrganizationChanged} />
          </div>
        )}

        {tab === "general" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 text-sm">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Providery TTS</h3>
            <p className="text-[11px] text-muted">
              Kreator: wybór providerów, klucze API, adres Voice Box i testy połączenia.
              {draft.enabled_providers && draft.enabled_providers.length > 0 && (
                <> Aktywne: {draft.enabled_providers.join(", ")}.</>
              )}
            </p>
            <button
              type="button"
              className="btn-primary text-xs self-start"
              onClick={() => {
                onClose();
                void openQuickSetupWindow().catch((e) => onError(String(e)));
              }}
            >
              Szybka konfiguracja…
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Minimax — języki</h3>
            <p className="text-[11px] text-muted">
              Języki dostępne w presetach TTS (głosy systemowe). Pusta lista = wszystkie z katalogu.
              Domyślnie tylko polski.
            </p>
            <div className="flex flex-wrap gap-3">
              {MINIMAX_LANGUAGE_CATALOG.map((lang) => {
                const enabled = draft.minimax_enabled_languages ?? [DEFAULT_MINIMAX_LANGUAGE];
                const checked =
                  enabled.length === 0 || enabled.includes(lang.code);
                return (
                  <label key={lang.code} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = draft.minimax_enabled_languages ?? [
                          DEFAULT_MINIMAX_LANGUAGE,
                        ];
                        let next: string[];
                        if (e.target.checked) {
                          next = [...new Set([...current, lang.code])];
                        } else {
                          next = current.filter((c) => c !== lang.code);
                        }
                        update("minimax_enabled_languages", next);
                      }}
                    />
                    <span>{lang.display_name}</span>
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="btn text-xs self-start"
              onClick={() => update("minimax_enabled_languages", [])}
            >
              Wszystkie języki (bez filtra)
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Minimax — głosy z API</h3>
            <p className="text-[11px] text-muted">
              Pobiera listę głosów systemowych, sklonowanych i wygenerowanych z konta MiniMax
              (endpoint get_voice). Wymaga skonfigurowanego MINIMAX_API_KEY.
            </p>
            {draft.minimax_voices_synced_at ? (
              <p className="text-[11px] text-muted/90">
                Ostatnia synchronizacja:{" "}
                {new Date(draft.minimax_voices_synced_at * 1000).toLocaleString("pl-PL")}
                {draft.minimax_synced_voices?.length
                  ? ` · ${draft.minimax_synced_voices.length} głosów systemowych`
                  : ""}
              </p>
            ) : (
              <p className="text-[11px] text-muted/90">
                Używany jest wbudowany katalog (kilka głosów PL/EN). Synchronizacja pobiera pełną
                listę z API.
              </p>
            )}
            <button
              type="button"
              className="btn text-xs self-start"
              disabled={syncingMinimaxVoices || !draft.effective_minimax_configured}
              onClick={() => {
                void (async () => {
                  setSyncingMinimaxVoices(true);
                  try {
                    const result = await syncMinimaxVoices();
                    const view = await getAppSettings();
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            minimax_synced_voices: view.minimax_synced_voices,
                            minimax_cloned_voices: view.minimax_cloned_voices,
                            minimax_voices_synced_at: view.minimax_voices_synced_at ?? null,
                          }
                        : d,
                    );
                    onSuccess?.(
                      `Zsynchronizowano: ${result.system_count} systemowych, ${result.cloning_count} klonów, ${result.generation_count} wygenerowanych.`,
                    );
                  } catch (e) {
                    onError(String(e));
                  } finally {
                    setSyncingMinimaxVoices(false);
                  }
                })();
              }}
            >
              {syncingMinimaxVoices ? "Synchronizuję…" : "Synchronizuj głosy z API"}
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Historia</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.history_compact_view}
                onChange={(e) => update("history_compact_view", e.target.checked)}
              />
              <span>Widok Compact — tytuł i data, kliknięcie odtwarza</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.history_click_to_play}
                onChange={(e) => update("history_click_to_play", e.target.checked)}
              />
              <span>Kliknięcie w wpis (widok pełny) odtwarza generację</span>
            </label>
            <p className="text-[11px] text-muted">
              Compact: jeden wiersz z tytułem i datą utworzenia — kliknięcie zawsze odtwarza. W widoku
              pełnym dotyczy obszaru karty poza przyciskami (tytuł, zapis, usuń itd.).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Kolejka generacji</h3>
            <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
              Maksymalna liczba równoległych generacji
              <input
                type="number"
                min={MIN_CONCURRENT_JOBS}
                max={MAX_CONCURRENT_JOBS}
                step={1}
                className="field"
                value={draft.max_concurrent_jobs ?? DEFAULT_MAX_CONCURRENT_JOBS}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) {
                    update(
                      "max_concurrent_jobs",
                      Math.max(MIN_CONCURRENT_JOBS, Math.min(MAX_CONCURRENT_JOBS, n)),
                    );
                  }
                }}
              />
            </label>
            <p className="text-[11px] text-muted">
              Ile zadań TTS może działać jednocześnie. Pozostałe czekają w kolejce. Większa wartość = szybsze rozkolejkowanie, ale ryzyko trafienia na limity Google.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Szybka generacja z paska</h3>
            <EditorQuickGenPanel
              value={draft.editor_quick_gen ?? defaultEditorQuickGenSettings()}
              onChange={(next) => update("editor_quick_gen", next)}
              filterPresets={draft.text_filters?.presets ?? []}
              onError={onError}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Tryb zapisu</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="save_mode"
                checked={draft.save_mode === "manual"}
                onChange={() => update("save_mode", "manual" as SaveMode)}
              />
              <span>Ręczny — zapisujesz generacje przyciskiem dyskietki</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="save_mode"
                checked={draft.save_mode === "auto"}
                onChange={() => update("save_mode", "auto" as SaveMode)}
              />
              <span>Automatyczny — każda generacja trafia od razu do archiwum</span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
              Format zapisu do archiwum
              <select
                className="field"
                value={draft.save_format}
                onChange={(e) => update("save_format", e.target.value as AudioFormat)}
              >
                {AUDIO_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Ścieżki</h3>
            <PathRow
              label="Folder tymczasowy (sesja)"
              value={draft.effective_temp_path}
              onBrowse={() => void browseTemp()}
              onReset={() => {
                update("temp_path", null);
                void load();
              }}
            />
            <PathRow
              label="Folder archiwum"
              value={draft.effective_archive_path}
              onBrowse={() => void browseArchive()}
              onReset={() => {
                update("archive_path", null);
                void load();
              }}
            />
            <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
              Maks. generacji w historii sesji (temp)
              <input
                type="number"
                className="field"
                min={MIN_TEMP_HISTORY_MAX}
                max={MAX_TEMP_HISTORY_MAX}
                value={draft.temp_history_max ?? DEFAULT_TEMP_HISTORY_MAX}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) {
                    update(
                      "temp_history_max",
                      Math.min(MAX_TEMP_HISTORY_MAX, Math.max(MIN_TEMP_HISTORY_MAX, n)),
                    );
                  }
                }}
              />
              <span className="text-[11px]">
                Limit dotyczy poprzednich uruchomień; bieżąca sesja jest zawsze zachowana w całości.
              </span>
            </label>
          </section>

          <ClearLocalDataPanel
            onError={onError}
            onSuccess={onSuccess}
            onCleared={() => {
              onLocalDataCleared?.();
              void getTokenUsage()
                .then(setUsage)
                .catch(() => setUsage(null));
            }}
          />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted">Profile API (Google)</h3>
              <button type="button" className="btn text-xs" onClick={addProfile}>
                Dodaj profil
              </button>
            </div>
            <p className="text-[11px] text-muted">
              {draft.env_api_key_available
                ? "Wykryto GOOGLE_API_KEY w pliku env."
                : "Brak GOOGLE_API_KEY w env — dodaj profil z kluczem."}
              {draft.active_api_id ? " Wybrany jest profil z listy." : " Używany jest klucz z env."}
            </p>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Aktywny klucz API
              <select
                className="field"
                value={draft.active_api_id ?? ""}
                onChange={(e) => update("active_api_id", e.target.value || null)}
              >
                <option value="">Domyślny z studios.env / .env</option>
                {draft.api_profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2">
              {draft.api_profiles.length === 0 ? (
                <p className="text-xs text-muted">Brak dodatkowych profili — używany jest klucz z pliku env.</p>
              ) : (
                draft.api_profiles.map((profile) => (
                  <ApiProfileCard
                    key={profile.id}
                    profile={profile}
                    expanded={editingProfileId === profile.id}
                    onToggle={() =>
                      setEditingProfileId((id) => (id === profile.id ? null : profile.id))
                    }
                    onChange={(patch) => updateProfile(profile.id, patch)}
                    onRemove={() => removeProfile(profile.id)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
        )}

        <footer className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Anuluj
          </button>
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatInt(n: number): string {
  return n.toLocaleString("pl-PL");
}

function UsagePanel({ usage }: { usage: UsageSummary | null }) {
  if (!usage) {
    return <p className="text-muted text-xs">Ładowanie statystyk…</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[11px] text-muted">
        Tokeny są zapisywane po zakończeniu generacji Google Gemini (pole usageMetadata z API).
        Voice Box zapisuje tylko liczbę znaków wejściowych — lokalny silnik nie zwraca tokenów.
        Szacunkowe koszty (płatny tier) przy generacji i w historii — na podstawie{" "}
        <a
          href="https://ai.google.dev/gemini-api/docs/pricing?hl=pl"
          className="underline hover:text-accent2"
          target="_blank"
          rel="noreferrer"
        >
          cennika Gemini TTS
        </a>
        .
      </p>
      <UsageTotalsBlock title="Bieżąca sesja" totals={usage.current_session} />
      <UsageTotalsBlock title="Łącznie (wszystkie sesje)" totals={usage.all_time} />
    </div>
  );
}

function UsageTotalsBlock({ title, totals }: { title: string; totals: UsageTotals }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wide text-muted">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Ukończone generacje</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.generations_done)}</dd>
        <dt className="text-muted">Tokeny wejścia</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.prompt_tokens)}</dd>
        <dt className="text-muted">Tokeny wyjścia</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.output_tokens)}</dd>
        <dt className="text-muted">Tokeny łącznie</dt>
        <dd className="text-right tabular-nums font-medium">{formatInt(totals.total_tokens)}</dd>
        <dt className="text-muted">Znaki wejściowe</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.input_chars)}</dd>
      </dl>
    </section>
  );
}

function PathRow({
  label,
  value,
  onBrowse,
  onReset,
}: {
  label: string;
  value: string;
  onBrowse: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <code className="text-[11px] bg-panel2 border border-border rounded px-2 py-1 break-all">
        {value}
      </code>
      <div className="flex gap-2">
        <button type="button" className="btn text-xs" onClick={onBrowse}>
          Wybierz folder…
        </button>
        <button type="button" className="btn text-xs" onClick={onReset}>
          Przywróć domyślną
        </button>
      </div>
    </div>
  );
}

function ApiProfileCard({
  profile,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  profile: ApiProfile;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ApiProfile>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-md bg-panel2/50 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button type="button" className="flex-1 text-left text-sm hover:text-accent2" onClick={onToggle}>
          {profile.name}
          <span className="text-muted text-xs ml-2">{expanded ? "▾" : "▸"}</span>
        </button>
        <button type="button" className="btn text-xs hover:!bg-red-900/40" onClick={onRemove}>
          Usuń
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 flex flex-col gap-2 border-t border-border">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Nazwa
            <input
              className="field"
              value={profile.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Klucz API
            <input
              className="field font-mono text-[11px]"
              type="password"
              value={profile.api_key}
              onChange={(e) => onChange({ api_key: e.target.value })}
              placeholder="AIza…"
              autoComplete="off"
            />
          </label>
        </div>
      )}
    </div>
  );
}
