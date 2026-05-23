import { useRef } from "react";
import type { TextFiltersSettings } from "../../lib/textFiltersTypes";
import { newTextFilterPreset } from "../../lib/textFiltersTypes";

interface Props {
  value: TextFiltersSettings;
  onChange: (next: TextFiltersSettings) => void;
  onError: (msg: string) => void;
}

export default function TextFiltersSettingsPanel({ value, onChange, onError }: Props) {
  const importRef = useRef<HTMLInputElement>(null);

  const updatePresetName = (id: string, name: string) => {
    onChange({
      ...value,
      presets: value.presets.map((p) => (p.id === id ? { ...p, name } : p)),
    });
  };

  const setActive = (id: string) => {
    onChange({ ...value, active_preset_id: id });
  };

  const duplicate = (id: string) => {
    const src = value.presets.find((p) => p.id === id);
    if (!src) return;
    const copy = newTextFilterPreset(`${src.name} (kopia)`);
    copy.builtins = { ...src.builtins };
    copy.custom = src.custom.map((r) => ({ ...r, id: crypto.randomUUID() }));
    onChange({
      ...value,
      presets: [...value.presets, copy],
      active_preset_id: copy.id,
    });
  };

  const remove = (id: string) => {
    if (value.presets.length <= 1) {
      onError("Musi pozostać co najmniej jeden preset.");
      return;
    }
    const next = value.presets.filter((p) => p.id !== id);
    const active =
      value.active_preset_id === id ? next[0]?.id ?? null : value.active_preset_id;
    onChange({ active_preset_id: active, presets: next });
  };

  const addPreset = () => {
    const p = newTextFilterPreset(`Preset ${value.presets.length + 1}`);
    onChange({
      ...value,
      presets: [...value.presets, p],
      active_preset_id: p.id,
    });
  };

  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(value.presets, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text-filter-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPresets = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as TextFiltersSettings["presets"];
        if (!Array.isArray(parsed) || parsed.length === 0) {
          onError("Nieprawidłowy plik presetów.");
          return;
        }
        onChange({
          active_preset_id: parsed[0]?.id ?? null,
          presets: parsed,
        });
      } catch {
        onError("Nie udało się wczytać JSON presetów.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="space-y-3 text-sm">
      <p className="text-xs text-muted">
        Presety filtrów są zapisywane w settings.json i eksportowane do integracji Cursor (tts-hub.json).
      </p>
      <ul className="space-y-2">
        {value.presets.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-panel2"
          >
            <input
              className="flex-1 min-w-[120px] bg-panel border border-border rounded px-2 py-1 text-xs"
              value={p.name}
              onChange={(e) => updatePresetName(p.id, e.target.value)}
            />
            <button
              type="button"
              className={`btn text-xs ${value.active_preset_id === p.id ? "btn-primary" : ""}`}
              onClick={() => setActive(p.id)}
            >
              Aktywny
            </button>
            <button type="button" className="btn text-xs" onClick={() => duplicate(p.id)}>
              Duplikuj
            </button>
            <button type="button" className="btn text-xs text-red-400" onClick={() => remove(p.id)}>
              Usuń
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn text-xs" onClick={addPreset}>
          + Nowy preset
        </button>
        <button type="button" className="btn text-xs" onClick={exportPresets}>
          Eksportuj JSON
        </button>
        <button type="button" className="btn text-xs" onClick={() => importRef.current?.click()}>
          Importuj JSON
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importPresets(f);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
