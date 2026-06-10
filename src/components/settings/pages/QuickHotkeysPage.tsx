import QuickHotkeysPanel from "../../QuickHotkeysPanel";
import { defaultQuickHotkeysSettings } from "../../../appSettings";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
}

export default function QuickHotkeysPage({ view, update, onError, onSuccess }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Szybkie skróty TTS</h2>
        <p className="text-xs text-muted">
          Globalne hotkeye — zaznaczony tekst w dowolnym oknie uruchamia TTS. Wymaga włączonego
          master switcha i uruchomionej aplikacji w tle.
        </p>
      </header>

      <QuickHotkeysPanel
        value={view.quick_hotkeys ?? defaultQuickHotkeysSettings()}
        onChange={(next) => update("quick_hotkeys", next)}
        filterPresets={view.text_filters?.presets ?? []}
        onError={onError}
        onSuccess={onSuccess}
      />
    </div>
  );
}
