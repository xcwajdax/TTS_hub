import { useState } from "react";
import type { EditorQuickGenSettings, SaveMode, TextFilterPreset, TextFiltersSettings } from "../../appSettings";
import type { IconSlug } from "../../lib/icons";
import Icon from "../Icon";
import CustomFiltersModal from "./CustomFiltersModal";

export type SettingsTab =
  | "general"
  | "quick_hotkeys"
  | "organization"
  | "filters";

interface Props {
  settings: TextFiltersSettings;
  activePreset: TextFilterPreset;
  editorQuickGen: EditorQuickGenSettings;
  saveMode: SaveMode;
  saveFormat: string;
  onSettingsChange: (next: TextFiltersSettings) => void;
  onPresetUpdate: (preset: TextFilterPreset) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onGenSlot: (slot: "slot1" | "slot2") => void;
  onSaveModeToggle: () => void;
}

const TOOLBAR_BTN =
  "inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-border bg-panel2 text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed";

const GEN_SETTINGS_BTN =
  "inline-flex items-center justify-center w-7 h-7 shrink-0 border-l border-border bg-panel2 text-muted hover:text-ink hover:bg-panel";

function GenSlotGroup({
  label,
  onGenerate,
  onOpenSettings,
}: {
  label: string;
  onGenerate: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="inline-flex items-stretch rounded border border-border overflow-hidden max-w-[180px]">
      <button
        type="button"
        className={`${TOOLBAR_BTN} !border-0 !rounded-none !min-w-0 flex-1 !px-2 gap-1`}
        title={`${label} — generuj`}
        onClick={onGenerate}
      >
        <Icon name="play" size={14} />
        <span className="truncate text-[11px]">{label}</span>
      </button>
      <button
        type="button"
        className={GEN_SETTINGS_BTN}
        title={`Ustawienia: ${label}`}
        aria-label={`Ustawienia: ${label}`}
        onClick={onOpenSettings}
      >
        <span className="text-[13px] leading-none" aria-hidden>
          ⚙
        </span>
      </button>
    </div>
  );
}

function BarBtn({
  title,
  onClick,
  icon,
  fallback,
  disabled,
  active,
  className = "",
}: {
  title: string;
  onClick?: () => void;
  icon?: IconSlug;
  fallback?: string;
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
      {icon ? (
        <Icon name={icon} size={16} />
      ) : (
        <span className="text-[11px] font-semibold leading-none">{fallback ?? "?"}</span>
      )}
    </button>
  );
}

export default function TextFiltersBar({
  settings,
  activePreset,
  editorQuickGen,
  saveMode,
  saveFormat,
  onSettingsChange,
  onPresetUpdate,
  onOpenSettings,
  onGenSlot,
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

  return (
    <>
      <div className="flex flex-col gap-1.5 px-1 py-2 text-xs border-b border-border/80">
        {/* Wiersz 1: toolbar edytora + filtr */}
        <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
          <div
            className="flex flex-wrap items-center gap-0.5 pr-2 mr-1 border-r border-border"
            role="toolbar"
            aria-label="Formatowanie"
          >
            <BarBtn title="Pogrubienie (wkrótce)" fallback="B" disabled />
            <BarBtn title="Kursywa (wkrótce)" fallback="I" disabled />
            <BarBtn title="Podkreślenie (wkrótce)" fallback="U" disabled />
            <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
            <BarBtn title="Wyrównaj do lewej (wkrótce)" fallback="≡" disabled />
            <BarBtn title="Wyśrodkuj (wkrótce)" fallback="≡" disabled />
            <BarBtn title="Wyrównaj do prawej (wkrótce)" fallback="≡" disabled />
            <BarBtn title="Wyjustuj (wkrótce)" fallback="≡" disabled />
            <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
            <BarBtn title="Cytat (wkrótce)" fallback="❝" disabled />
            <BarBtn title="Cofnij (wkrótce)" icon="undo" disabled />
            <BarBtn title="Ponów (wkrótce)" icon="redo" disabled />
          </div>

          <label className="flex items-center gap-1.5 text-muted shrink-0">
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
            className="btn text-xs py-1 h-7"
            onClick={() => setRulesOpen(true)}
            title="Reguły filtrów tekstu"
          >
            Reguły…
            {activePreset.custom.length > 0 ? ` (${activePreset.custom.length})` : ""}
          </button>
        </div>

        {/* Wiersz 2: szybkie akcje */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
          <GenSlotGroup
            label={editorQuickGen.slot1.label}
            onGenerate={() => onGenSlot("slot1")}
            onOpenSettings={() => onOpenSettings("general")}
          />
          <GenSlotGroup
            label={editorQuickGen.slot2.label}
            onGenerate={() => onGenSlot("slot2")}
            onOpenSettings={() => onOpenSettings("general")}
          />

          <span className="w-px h-5 bg-border mx-0.5 hidden sm:block" aria-hidden />

          <button
            type="button"
            className={`${TOOLBAR_BTN} !px-2 text-[11px]`}
            title="Szybkie skróty TTS — ustawienia"
            onClick={() => onOpenSettings("quick_hotkeys")}
          >
            <span className="hidden sm:inline">Szybki hotkey</span>
            <span className="sm:hidden font-mono">⌨</span>
          </button>

          <BarBtn
            title="Folder archiwum — ustawienia ścieżek"
            icon="folder"
            onClick={() => onOpenSettings("general")}
          />

          <BarBtn
            title={autosaveOn ? "Autozapis włączony — kliknij, aby wyłączyć" : "Autozapis wyłączony — kliknij, aby włączyć"}
            icon="save"
            active={autosaveOn}
            onClick={onSaveModeToggle}
          />
          <span className="text-[10px] text-muted hidden md:inline">
            {autosaveOn ? "Auto" : "Ręczny"}
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

          <button
            type="button"
            className="btn text-xs py-1 h-7 ml-auto hidden lg:inline-flex"
            onClick={() => onOpenSettings("filters")}
            title="Zarządzaj presetami filtrów"
          >
            Presety filtrów…
          </button>
        </div>
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
