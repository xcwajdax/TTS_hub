import { AUDIO_FORMATS } from "../../../audioFormats";
import {
  getAppSettings,
  pickArchiveFolderSettings,
  pickTempFolder,
} from "../../../api/tauri";
import {
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_QUICK_HISTORY_PAGE_SIZE,
  DEFAULT_TEMP_HISTORY_MAX,
  MAX_CONCURRENT_JOBS,
  MAX_QUICK_HISTORY_PAGE_SIZE,
  MAX_TEMP_HISTORY_MAX,
  MIN_CONCURRENT_JOBS,
  MIN_QUICK_HISTORY_PAGE_SIZE,
  MIN_TEMP_HISTORY_MAX,
  type SaveMode,
} from "../../../appSettings";
import type { AudioFormat } from "../../../types";
import SettingsPageHeader from "../components/SettingsPageHeader";
import SettingsSection from "../components/SettingsSection";
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

export default function GeneralPage({ view, update, onError, onSuccess }: Props) {
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

  return (
    <div className="flex flex-col gap-8 text-sm">
      <SettingsPageHeader
        title="Ogólne"
        description="Kolejka generacji, tryb zapisu i ścieżki plików. Providery i profile głosu są w osobnych zakładkach. Zmiany zapisują się automatycznie."
      />

      <SettingsSection title="Kolejka generacji">
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
      </SettingsSection>

      <SettingsSection title="Historia" borderTop>
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
      </SettingsSection>

      <SettingsSection title="Tryb zapisu" borderTop>
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
      </SettingsSection>

      <SettingsSection title="Ścieżki" borderTop>
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
        <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
          Liczba ostatnich generacji w panelu bocznym
          <input
            type="number"
            className="field"
            min={MIN_QUICK_HISTORY_PAGE_SIZE}
            max={MAX_QUICK_HISTORY_PAGE_SIZE}
            value={view.quick_history_page_size ?? DEFAULT_QUICK_HISTORY_PAGE_SIZE}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) {
                update(
                  "quick_history_page_size",
                  Math.min(
                    MAX_QUICK_HISTORY_PAGE_SIZE,
                    Math.max(MIN_QUICK_HISTORY_PAGE_SIZE, n),
                  ),
                );
              }
            }}
          />
          <span className="text-[11px]">
            Ile wierszy pokazać na start w „Ostatnie generacje”; przycisk „Załaduj więcej”
            dokłada tyle samo.
          </span>
        </label>
      </SettingsSection>
    </div>
  );
}
