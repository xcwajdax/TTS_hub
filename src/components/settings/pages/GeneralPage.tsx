import { useState } from "react";
import { AUDIO_FORMATS } from "../../../audioFormats";
import {
  getAppSettings,
  openQuickSetupWindow,
  pickArchiveFolderSettings,
  pickTempFolder,
} from "../../../api/tauri";
import {
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_TEMP_HISTORY_MAX,
  MAX_CONCURRENT_JOBS,
  MAX_TEMP_HISTORY_MAX,
  MIN_CONCURRENT_JOBS,
  MIN_TEMP_HISTORY_MAX,
  newApiProfile,
  type ApiProfile,
  type SaveMode,
} from "../../../appSettings";
import type { AudioFormat } from "../../../types";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
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
    <div className="flex flex-col gap-1 max-w-md">
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
        <button
          type="button"
          className="flex-1 text-left text-sm hover:text-accent2"
          onClick={onToggle}
        >
          {profile.name}
          <span className="text-muted text-xs ml-2">{expanded ? "▾" : "▸"}</span>
        </button>
        <button
          type="button"
          className="btn text-xs hover:!bg-red-900/40"
          onClick={onRemove}
        >
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

export default function GeneralPage({ view, update, onError, onSuccess }: Props) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const reloadEffectivePaths = async () => {
    try {
      const fresh = await getAppSettings();
      update("effective_temp_path", fresh.effective_temp_path);
      update("effective_archive_path", fresh.effective_archive_path);
    } catch (e) {
      onError(String(e));
    }
  };

  const browseTemp = async () => {
    try {
      const picked = await pickTempFolder();
      if (picked) {
        update("temp_path", picked);
        update("effective_temp_path", picked);
        onSuccess?.("Folder tymczasowy zaktualizowany");
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
        onSuccess?.("Folder archiwum zaktualizowany");
      }
    } catch (e) {
      onError(String(e));
    }
  };

  const addProfile = () => {
    const profile = newApiProfile(`Profil ${view.api_profiles.length + 1}`);
    update("api_profiles", [...view.api_profiles, profile]);
    update("active_api_id", profile.id);
    setEditingProfileId(profile.id);
  };

  const removeProfile = (id: string) => {
    const next = view.api_profiles.filter((p) => p.id !== id);
    update("api_profiles", next);
    if (view.active_api_id === id) {
      update("active_api_id", next[0]?.id ?? null);
    }
    if (editingProfileId === id) setEditingProfileId(null);
  };

  const updateProfile = (id: string, patch: Partial<ApiProfile>) => {
    update(
      "api_profiles",
      view.api_profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  return (
    <div className="flex flex-col gap-8 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Ogólne</h2>
        <p className="text-xs text-muted">
          Providery, kolejka generacji, tryb zapisu, ścieżki, profile API. Zmiany zapisują się
          automatycznie.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-muted">Providery TTS</h3>
        <p className="text-[11px] text-muted">
          Kreator: wybór providerów, klucze API, adres Voice Box i testy połączenia.
          {view.enabled_providers && view.enabled_providers.length > 0 && (
            <> Aktywne: {view.enabled_providers.join(", ")}.</>
          )}
        </p>
        <button
          type="button"
          className="btn-primary text-xs self-start"
          onClick={() => {
            void openQuickSetupWindow().catch((e) => onError(String(e)));
          }}
        >
          Szybka konfiguracja…
        </button>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-xs uppercase tracking-wide text-muted">Kolejka generacji</h3>
        <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
          Maksymalna liczba równoległych generacji
          <input
            type="number"
            min={MIN_CONCURRENT_JOBS}
            max={MAX_CONCURRENT_JOBS}
            step={1}
            className="field"
            value={view.max_concurrent_jobs ?? DEFAULT_MAX_CONCURRENT_JOBS}
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
          Ile zadań TTS może działać jednocześnie. Pozostałe czekają w kolejce. Większa wartość =
          szybsze rozkolejkowanie, ale ryzyko trafienia na limity Google.
        </p>
        <h4 className="text-[11px] uppercase tracking-wide text-muted mt-2">Tryb bezpieczny</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!view.safe_mode}
            onChange={(e) => update("safe_mode", e.target.checked)}
          />
          <span>Wymagaj zatwierdzenia przed syntezą (to samo co kłódka w pasku tytułu)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={view.safe_mode_auto_open_queue ?? true}
            onChange={(e) => update("safe_mode_auto_open_queue", e.target.checked)}
          />
          <span>Automatycznie rozwijaj panel kolejki przy nowej generacji do zatwierdzenia</span>
        </label>
        <p className="text-[11px] text-muted">
          W trybie bezpiecznym wszystkie źródła (edytor, Cursor, skróty, HTTP, roleplay) trafiają do
          zakładki „Zatwierdź”. Odrzucone pozycje pozostają w bazie ze statusem odrzuconym.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-xs uppercase tracking-wide text-muted">Historia</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={view.history_compact_view}
            onChange={(e) => update("history_compact_view", e.target.checked)}
          />
          <span>Widok kompaktowy w zakładce Historia</span>
        </label>
        <p className="text-[11px] text-muted">
          Prawy panel w widoku TTS jest zawsze kompaktowy. Kliknięcie wpisu ładuje nagranie do
          timeline i tekst do edytora bez auto-odtwarzania. Akcje na pliku (archiwum, folder,
          eksplorator, kolor, tagi) są w menu panelu timeline.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-xs uppercase tracking-wide text-muted">Tryb zapisu</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="save_mode"
            checked={view.save_mode === "manual"}
            onChange={() => update("save_mode", "manual" as SaveMode)}
          />
          <span>Ręczny — zapisujesz generacje przyciskiem dyskietki</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="save_mode"
            checked={view.save_mode === "auto"}
            onChange={() => update("save_mode", "auto" as SaveMode)}
          />
          <span>Automatyczny — każda generacja trafia od razu do archiwum</span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
          Format zapisu do archiwum
          <select
            className="field"
            value={view.save_format}
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

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-xs uppercase tracking-wide text-muted">Ścieżki</h3>
        <PathRow
          label="Folder tymczasowy (sesja)"
          value={view.effective_temp_path}
          onBrowse={() => void browseTemp()}
          onReset={() => {
            update("temp_path", null);
            void reloadEffectivePaths();
          }}
        />
        <PathRow
          label="Folder archiwum"
          value={view.effective_archive_path}
          onBrowse={() => void browseArchive()}
          onReset={() => {
            update("archive_path", null);
            void reloadEffectivePaths();
          }}
        />
        <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
          Maks. generacji w historii sesji (temp)
          <input
            type="number"
            className="field"
            min={MIN_TEMP_HISTORY_MAX}
            max={MAX_TEMP_HISTORY_MAX}
            value={view.temp_history_max ?? DEFAULT_TEMP_HISTORY_MAX}
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

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs uppercase tracking-wide text-muted">Profile API (Google)</h3>
          <button type="button" className="btn text-xs" onClick={addProfile}>
            Dodaj profil
          </button>
        </div>
        <p className="text-[11px] text-muted">
          {view.env_api_key_available
            ? "Wykryto GOOGLE_API_KEY w pliku env."
            : "Brak GOOGLE_API_KEY w env — dodaj profil z kluczem."}
          {view.active_api_id ? " Wybrany jest profil z listy." : " Używany jest klucz z env."}
        </p>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Aktywny klucz API
          <select
            className="field"
            value={view.active_api_id ?? ""}
            onChange={(e) => update("active_api_id", e.target.value || null)}
          >
            <option value="">Domyślny z studios.env / .env</option>
            {view.api_profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2">
          {view.api_profiles.length === 0 ? (
            <p className="text-xs text-muted">
              Brak dodatkowych profili — używany jest klucz z pliku env.
            </p>
          ) : (
            view.api_profiles.map((profile) => (
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
  );
}
