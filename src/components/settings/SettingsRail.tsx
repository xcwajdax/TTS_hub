import Icon from "../Icon";
import {
  SETTINGS_OVERVIEW_TAB,
  SETTINGS_TAB_GROUPS,
  SETTINGS_TABS,
  type SettingsTabMeta,
  type SettingsViewTab,
} from "./settingsTabs";

interface Props {
  active: SettingsViewTab;
  onSelect: (id: SettingsViewTab) => void;
}

export default function SettingsRail({ active, onSelect }: Props) {
  return (
    <nav
      className="settings-rail shrink-0 flex flex-col gap-0.5 py-2 px-1 border-r border-border bg-panel overflow-y-auto w-11"
      role="tablist"
      aria-label="Sekcje ustawień"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === SETTINGS_OVERVIEW_TAB}
        title="Przegląd kategorii"
        onClick={() => onSelect(SETTINGS_OVERVIEW_TAB)}
        className={`settings-rail__btn flex items-center justify-center py-2.5 rounded-md w-full transition-colors ${
          active === SETTINGS_OVERVIEW_TAB
            ? "bg-panel2 text-heading"
            : "text-muted hover:text-heading hover:bg-panel2/50"
        }`}
      >
        <Icon name="tab-settings" size={18} className="opacity-90" />
      </button>

      {SETTINGS_TAB_GROUPS.map((group, groupIndex) => {
        const tabs = SETTINGS_TABS.filter((t) => t.group === group.id);
        if (tabs.length === 0) return null;
        return (
          <div
            key={group.id}
            className={`flex flex-col gap-0.5 ${groupIndex > 0 ? "pt-1 border-t border-border/60" : ""}`}
          >
            {tabs.map((t: SettingsTabMeta) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                title={`${t.label} — ${t.description}`}
                onClick={() => onSelect(t.id)}
                className={`settings-rail__btn flex items-center justify-center py-2.5 rounded-md w-full transition-colors ${
                  active === t.id
                    ? "bg-panel2 text-heading"
                    : "text-muted hover:text-heading hover:bg-panel2/50"
                }`}
              >
                <Icon name={t.icon} size={18} className="opacity-90" />
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
