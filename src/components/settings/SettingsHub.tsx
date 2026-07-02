import Icon from "../Icon";
import {
  SETTINGS_TAB_GROUPS,
  SETTINGS_TABS,
  type SettingsTabId,
  type SettingsTabMeta,
} from "./settingsTabs";

interface Props {
  onSelect: (id: SettingsTabId) => void;
  /** Hide voice profiles when the parent cannot handle profile selection. */
  showVoiceProfiles?: boolean;
}

export default function SettingsHub({ onSelect, showVoiceProfiles = true }: Props) {
  const tabs = SETTINGS_TABS.filter(
    (t) => showVoiceProfiles || t.id !== "voice_profiles",
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold">Ustawienia</h2>
        <p className="text-sm text-muted leading-relaxed max-w-2xl">
          Wybierz sekcję poniżej lub skorzystaj z paska po lewej. Zmiany zapisują się
          automatycznie.
        </p>
      </header>

      {SETTINGS_TAB_GROUPS.map((group) => {
        const groupTabs = tabs.filter((t) => t.group === group.id);
        if (groupTabs.length === 0) return null;
        return (
          <section key={group.id} className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-heading tracking-tight">
              {group.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupTabs.map((t: SettingsTabMeta) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="settings-hub__card rounded-xl border border-border bg-panel2 p-5 flex flex-col gap-3 text-left transition-colors hover:border-accent/40 hover:bg-panel2/80 min-h-[7.5rem]"
                >
                  <div className="rounded-lg bg-panel p-2.5 text-accent w-fit shrink-0">
                    <Icon name={t.icon} size={24} className="opacity-90" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <h4 className="font-semibold text-heading text-lg leading-snug">
                      {t.label}
                    </h4>
                    <p className="text-sm text-muted leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
