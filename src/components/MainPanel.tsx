import { useEffect, useState } from "react";
import { generate, listVoices } from "../api/tauri";
import { syncSaveFormatFromSettings } from "../audioFormats";
import { usePlayback } from "../context/PlaybackContext";
import { useJobs, useLatestJobProgress } from "../context/JobsContext";
import type { Generation } from "../types";
import { DEFAULT_TTS_MODEL } from "../ttsModels";
import AdvancedSettingsModal from "./AdvancedSettingsModal";
import Settings, { type SettingsState } from "./Settings";
import GenerationProgressBar from "./GenerationProgress";

interface Props {
  onGenerated: (g: Generation) => void;
  onError: (e: string) => void;
}

const DEFAULT_SETTINGS: SettingsState = {
  model: DEFAULT_TTS_MODEL,
  voice: "Kore",
  style: "",
  multiSpeaker: false,
  speakers: [
    { speaker: "Mowca1", voice: "Kore" },
    { speaker: "Mowca2", voice: "Puck" },
  ],
};

export default function MainPanel({ onGenerated: _onGenerated, onError }: Props) {
  const { editorText, setEditorText } = usePlayback();
  const { trackEnqueued, activeJobs } = useJobs();
  const progress = useLatestJobProgress();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);

  useEffect(() => {
    listVoices().then(setVoices).catch((e) => onError(String(e)));
    void syncSaveFormatFromSettings();
  }, [onError]);

  const onGenerate = async () => {
    if (!editorText.trim() || enqueuing) return;
    setEnqueuing(true);
    const textSnapshot = editorText;
    try {
      const g = await generate({
        text: textSnapshot,
        model: settings.model,
        voice: settings.voice,
        style: settings.style.trim() || null,
        format: "wav",
        multi_speaker: settings.multiSpeaker ? settings.speakers : null,
      });
      trackEnqueued(g);
      setEditorText("");
    } catch (e) {
      onError(String(e));
    } finally {
      setEnqueuing(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void onGenerate();
    }
  };

  const showProgress = progress.active || progress.phase === "done";
  const queuedCount = activeJobs.filter((j) => j.status === "queued").length;
  const runningCount = activeJobs.filter((j) => j.status === "running").length;
  const activeBadge = activeJobs.length > 0
    ? `${runningCount} w toku · ${queuedCount} w kolejce`
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-panel">
        <div className="min-w-0">
          <div className="text-lg font-semibold">TTS Hub</div>
          <div className="text-xs text-muted">Google Gemini TTS · lokalne API · localhost:8765</div>
        </div>
        <div className="flex items-center gap-2">
          {activeBadge && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-panel2 border border-border text-muted">
              {activeBadge}
            </span>
          )}
          <button
            type="button"
            className="btn px-2.5"
            onClick={() => setAdvancedOpen(true)}
            title="Ustawienia zaawansowane"
            aria-label="Ustawienia zaawansowane"
          >
            ⚙
          </button>
          <button
            className="btn-primary"
            onClick={() => void onGenerate()}
            disabled={enqueuing || !editorText.trim()}
            title="Ctrl+Enter — dodaje do kolejki, można uruchamiać kolejne"
          >
            {enqueuing ? "Dodawanie..." : "Generuj (Ctrl+Enter)"}
          </button>
        </div>
      </div>

      <AdvancedSettingsModal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        onSaved={() => void syncSaveFormatFromSettings()}
        onError={onError}
      />

      <Settings state={settings} voices={voices} onChange={setSettings} onError={onError} />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
        <div
          className={`grid shrink-0 transition-[grid-template-rows,opacity,margin-bottom] duration-300 ease-out ${
            showProgress ? "grid-rows-[1fr] opacity-100 mb-3" : "grid-rows-[0fr] opacity-0 mb-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <GenerationProgressBar progress={progress} />
          </div>
        </div>
        <textarea
          className="flex-1 w-full min-h-[200px] resize-none bg-panel2 border border-border rounded-lg p-3 text-sm leading-relaxed"
          placeholder={
            settings.multiSpeaker
              ? "Tekst dialogu, np.:\nMowca1: Czesc, jak sie masz?\nMowca2: Wszystko swietnie, dzieki!"
              : "Wpisz tekst, ktory chcesz zamienic na mowe..."
          }
          value={editorText}
          onChange={(e) => setEditorText(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
