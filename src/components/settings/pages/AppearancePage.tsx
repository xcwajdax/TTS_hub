import AppearancePanel from "../../AppearancePanel";
import { DEFAULT_SKIN_ID } from "../../../skins/applySkin";
import { normalizeTimelineViewMode } from "../../../lib/timelineView";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
}

export default function AppearancePage({ view, update, onError }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Wygląd</h2>
        <p className="text-xs text-muted">
          Skórka interfejsu i styl dolnego paska z falą dźwiękową. Szybki przełącznik skórek
          znajdziesz też w pasku tytułu okna.
        </p>
      </header>

      <AppearancePanel
        activeSkinId={view.active_skin_id ?? DEFAULT_SKIN_ID}
        onSelectSkin={(id) => update("active_skin_id", id)}
        timelineView={normalizeTimelineViewMode(view.timeline_view)}
        onTimelineViewChange={(mode) => update("timeline_view", mode)}
        onError={onError}
      />
    </div>
  );
}
