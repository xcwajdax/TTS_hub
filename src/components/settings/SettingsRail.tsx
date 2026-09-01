import Icon from "../Icon";
import type { IconSlug } from "../../lib/icons";
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

function RailButton({
  active,
  label,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: IconSlug;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      className={`settings-rail__btn flex items-center gap-2 px-2 py-1.5 rounded-md w-full text-left text-xs transition-colors ${
        active
          ? "bg-panel2 text-heading"
          : "text-muted hover:text-heading hover:bg-panel2/50"
      }`}
    >
      <Icon name={icon} size={16} className="shrink-0 opacity-90" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function SettingsRail({ active, onSelect }: Props) {
  return (
    <nav
      className="settings-rail shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-border bg-panel overflow-y-auto w-44"
      role="tablist"
      aria-label="Sekcje ustawień"
    >
      <RailButton
        active={active === SETTINGS_OVERVIEW_TAB}
        label="Przegląd"
        icon="tab-settings"
        title="Przegląd kategorii"
        onClick={() => onSelect(SETTINGS_OVERVIEW_TAB)}
      />

      {SETTINGS_TAB_GROUPS.map((group, groupIndex) => {
        const tabs = SETTINGS_TABS.filter((t) => t.group === group.id);
        if (tabs.length === 0) return null;
        return (
          <div
            key={group.id}
            className={`flex flex-col gap-0.5 ${groupIndex > 0 ? "pt-1.5 mt-1 border-t border-border/60" : "pt-1"}`}
          >
            <div className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted/80">
              {group.label}
            </div>
            {tabs.map((t: SettingsTabMeta) => (
              <RailButton
                key={t.id}
                active={active === t.id}
                label={t.label}
                icon={t.icon}
                title={`${t.label} — ${t.description}`}
                onClick={() => onSelect(t.id)}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
