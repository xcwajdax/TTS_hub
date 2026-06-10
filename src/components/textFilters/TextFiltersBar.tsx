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
  onVoiceProfileChange: (profileId: string | null) => void;
  onSaveModeToggle: () => void;
}

const TOOLBAR_BTN =
  "inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-border bg-panel2 text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed";

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
      className={`${TOOLBAR_BTN} ${active ? "border-accent2/50 bg-panel text-accent2" : ""} ${className}`.trim()}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
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
  onVoiceProfileChange,
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2.5 text-xs border-b border-border/80">
        <ActiveVoiceProfileHero
          ttsSettings={ttsSettings}
          activeVoiceProfileId={activeVoiceProfileId}
          onVoiceProfileChange={onVoiceProfileChange}
        />

        <span
          className="hidden sm:block w-px h-12 bg-border shrink-0"
          aria-hidden
        />

        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-panel2 text-ink shrink-0"
          title="Aktywny dostawca TTS"
        >
          <Icon
            name={PROVIDER_TABS.find((t) => t.id === ttsSettings.provider)?.icon ?? "info"}
            size={14}
          />
          <span className="truncate max-w-[140px]">{providerLabel}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
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
          <span className="text-[10px] text-muted hidden sm:inline">
            {autosaveOn ? "Zapis do folderu" : "Bez autozapisu"}
          </span>
          <button
            type="button"
            className={`${TOOLBAR_BTN} !px-2 gap-1`}
            title="Format zapisu — ustawienia ogólne"
            onClick={() => onOpenSettings("general")}
          >
            <span className="uppercase font-mono text-[10px]">{saveFormat}</span>
            <Icon name="chevron-down" size={12} className="opacity-60" />
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-muted shrink-0 ml-auto">
          Filtr
          <select
            className="bg-panel2 border border-border rounded px-2 py-1 text-ink min-w-[120px] max-w-[200px]"
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
          className="btn text-xs py-1 h-7 shrink-0"
          onClick={() => setRulesOpen(true)}
          title="Reguły filtrów tekstu"
        >
          Reguły…
          {activePreset.custom.length > 0 ? ` (${activePreset.custom.length})` : ""}
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
