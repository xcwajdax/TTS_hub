import TextFiltersSettingsPanel from "../../textFilters/TextFiltersSettingsPanel";
import { defaultTextFiltersSettings } from "../../../appSettings";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
}

export default function FiltersPage({ view, update, onError }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Filtry tekstu</h2>
        <p className="text-xs text-muted">
          Presety czyszczące tekst przed syntezą (usuwanie kodu, cytatów, własne reguły regex).
          Zmiany zapisują się automatycznie.
        </p>
      </header>

      <TextFiltersSettingsPanel
        value={view.text_filters ?? defaultTextFiltersSettings()}
        onChange={(next) => update("text_filters", next)}
        onError={onError}
      />
    </div>
  );
}
