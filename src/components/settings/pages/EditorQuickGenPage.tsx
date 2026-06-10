import EditorQuickGenPanel from "../../EditorQuickGenPanel";
import { defaultEditorQuickGenSettings } from "../../../appSettings";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
}

export default function EditorQuickGenPage({ view, update, onError }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Szybka generacja z paska</h2>
        <p className="text-xs text-muted">
          Przyciski Gen Ust 1 i Gen Ust 2 na pasku edytora używają tych presetów TTS (provider,
          głos, filtr, format).
        </p>
      </header>

      <EditorQuickGenPanel
        value={view.editor_quick_gen ?? defaultEditorQuickGenSettings()}
        onChange={(next) => update("editor_quick_gen", next)}
        filterPresets={view.text_filters?.presets ?? []}
        onError={onError}
      />
    </div>
  );
}
