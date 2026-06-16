import { useState } from "react";
import type { SaveMode, TextFilterPreset, TextFiltersSettings } from "../../appSettings";
import type { SettingsState } from "../Settings";
import { PROVIDER_TABS } from "../../lib/providerSwitch";
import type { IconSlug } from "../../lib/icons";
import Icon from "../Icon";
import ActiveVoiceProfileHero from "../ActiveVoiceProfileHero";
import CustomFiltersModal from "./CustomFiltersModal";
import type { SettingsTabId } from "../settings/settingsTabs";

export type SettingsTab = SettingsTabId;

interface Props {
  settings: TextFiltersSettings;
  activePreset: TextFilterPreset;
  ttsSettings: SettingsState;
  activeVoiceProfileId: string | null;
  saveMode: SaveMode;
  saveFormat: string;
  onSettingsChange: (next: TextFiltersSettings) => void;
  onPresetUpdate: (preset: TextFilterPreset) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onSaveModeToggle: () => void;
}

const TOOLBAR_BTN =
  "inline-flex items-center justify-center min-w-[22px] h-6 px-0.5 text-ink hover:bg-panel2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0";

function BarBtn({
  title,
  onClick,
  icon,
  disabled,
  active,
  className = "",
}: {
  title: string;
  onClick?: () => void;
  icon?: IconSlug;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${TOOLBAR_BTN} ${active ? "text-accent2" : ""} ${className}`.trim()}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
    </button>
  );
}

export default function TextFiltersBar({
  settings,
  activePreset,
  ttsSettings,
  activeVoiceProfileId,
  saveMode,
  saveFormat,
  onSettingsChange,
  onPresetUpdate,
  onOpenSettings,
  onSaveModeToggle,
}: Props) {
  const [rulesOpen, setRulesOpen] = useState(false);

  const selectPreset = (id: string) => {
    onSettingsChange({ ...settings, active_preset_id: id });
  };

  const updatePresetInSettings = (preset: TextFilterPreset) => {
    onPresetUpdate(preset);
    onSettingsChange({
      ...settings,
      presets: settings.presets.map((p) => (p.id === preset.id ? preset : p)),
    });
  };

  const autosaveOn = saveMode === "auto";
  const providerLabel =
    PROVIDER_TABS.find((t) => t.id === ttsSettings.provider)?.label ?? ttsSettings.provider;
  const providerIcon =
    PROVIDER_TABS.find((t) => t.id === ttsSettings.provider)?.icon ?? "info";

  return (
    <>
      <div className="text-filters-bar flex flex-nowrap items-center gap-x-2 px-0 text-xs overflow-x-auto scrollbar-thin">
        <ActiveVoiceProfileHero
          ttsSettings={ttsSettings}
          activeVoiceProfileId={activeVoiceProfileId}
        />

        <span
          className="inline-flex items-center gap-1 text-muted shrink-0"
          title={`Dostawca: ${providerLabel}`}
        >
          <Icon name={providerIcon} size={13} />
          <span className="truncate max-w-[5rem] hidden sm:inline">{providerLabel}</span>
        </span>

        <label className="inline-flex items-center gap-1 text-muted shrink-0">
          <span className="hidden md:inline">Filtr</span>
          <select
            className="toolbar-select"
            value={activePreset.id}
            onChange={(e) => selectPreset(e.target.value)}
          >
            {settings.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="text-xs text-muted hover:text-ink shrink-0 whitespace-nowrap"
          onClick={() => setRulesOpen(true)}
          title="Reguły filtrów tekstu"
        >
          Reguły{activePreset.custom.length > 0 ? ` (${activePreset.custom.length})` : ""}
        </button>

        <span className="w-px h-4 bg-border/60 shrink-0 mx-0.5" aria-hidden />

        <BarBtn
          title="Folder archiwum — ustawienia ścieżek"
          icon="folder"
          onClick={() => onOpenSettings("organization")}
        />
        <BarBtn
          title={
            autosaveOn
              ? "Autozapis włączony — kliknij, aby wyłączyć"
              : "Autozapis wyłączony — kliknij, aby włączyć"
          }
          icon="save"
          active={autosaveOn}
          onClick={onSaveModeToggle}
        />
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-[10px] uppercase font-mono text-muted hover:text-ink shrink-0"
          title="Format zapisu — ustawienia ogólne"
          onClick={() => onOpenSettings("general")}
        >
          {saveFormat}
          <Icon name="chevron-down" size={10} className="opacity-60" />
        </button>
      </div>

      <CustomFiltersModal
        open={rulesOpen}
        preset={activePreset}
        onClose={() => setRulesOpen(false)}
        onChange={updatePresetInSettings}
      />
    </>
  );
}
