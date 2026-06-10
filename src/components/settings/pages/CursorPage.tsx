import { useEffect, useState } from "react";
import CursorIntegrationPanel from "../../CursorIntegrationPanel";
import { defaultCursorIntegration } from "../../../appSettings";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";
import { listVoices } from "../../../api/tauri";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
}

export default function CursorPage({ view, update, onError }: Props) {
  const [voices, setVoices] = useState<string[]>([]);

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Cursor — integracja Agent Chat</h2>
        <p className="text-xs text-muted">
          TTS Hub może czytać na głos krótkie podsumowania po polsku z odpowiedzi agenta w
          Cursorze. Wymaga instalacji hooków lub użycia skilla <code>tts-hub-speak</code>.
        </p>
      </header>

      <CursorIntegrationPanel
        value={view.cursor_integration ?? defaultCursorIntegration()}
        onChange={(next) => update("cursor_integration", next)}
        voices={voices}
        onError={onError}
      />
    </div>
  );
}
