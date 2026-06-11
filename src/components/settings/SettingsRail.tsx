import Icon from "../Icon";
import {
  SETTINGS_TAB_GROUPS,
  SETTINGS_TABS,
  type SettingsTabId,
  type SettingsTabMeta,
} from "./settingsTabs";

interface Props {
  active: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}

export default function SettingsRail({ active, onSelect }: Props) {
  return (
    <nav
      className="settings-rail shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-border bg-panel overflow-y-auto w-[4.5rem]"
      role="tablist"
      aria-label="Sekcje ustawień"
    >
      {SETTINGS_TAB_GROUPS.map((group) => {
        const tabs = SETTINGS_TABS.filter((t) => t.group === group.id);
        if (tabs.length === 0) return null;
        return (
          <div key={group.id} className="flex flex-col gap-0.5">
            <span
              className="text-[8px] uppercase tracking-wider text-muted/70 text-center px-0.5 pt-1 pb-0.5"
              aria-hidden
            >
              {group.label}
            </span>
            {tabs.map((t: SettingsTabMeta) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                title={`${t.label} — ${t.description}`}
                onClick={() => onSelect(t.id)}
                className={`settings-rail__btn flex flex-col items-center justify-center gap-0.5 py-2 rounded-md min-w-0 w-full transition-colors ${
                  active === t.id
                    ? "bg-panel2 text-heading"
                    : "text-muted hover:text-heading hover:bg-panel2/50"
                }`}
              >
                <Icon name={t.icon} size={18} className="opacity-90" />
                <span className="text-[9px] font-medium leading-tight text-center truncate w-full px-0.5">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
