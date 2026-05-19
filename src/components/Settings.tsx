import { useEffect, useState } from "react";
import { listModels } from "../api/tauri";
import { DEFAULT_TTS_MODEL, FALLBACK_TTS_MODELS, type TtsModelInfo } from "../ttsModels";
import type { SpeakerConfig, TtsModel } from "../types";
import VoiceSamples from "./VoiceSamples";

export interface SettingsState {
  model: TtsModel;
  voice: string;
  style: string;
  multiSpeaker: boolean;
  speakers: SpeakerConfig[];
}

interface Props {
  state: SettingsState;
  voices: string[];
  onChange: (s: SettingsState) => void;
  onError?: (message: string) => void;
}

export default function Settings({ state, voices, onChange, onError }: Props) {
  const [models, setModels] = useState<TtsModelInfo[]>(FALLBACK_TTS_MODELS);

  useEffect(() => {
    listModels()
      .then((apiModels) => {
        if (apiModels.length === 0) return;
        setModels(apiModels);
        const ids = new Set(apiModels.map((m) => m.id));
        if (!ids.has(state.model)) {
          const preferred = apiModels.find((m) => m.id === DEFAULT_TTS_MODEL) ?? apiModels[0];
          onChange({ ...state, model: preferred.id });
        }
      })
      .catch(() => setModels(FALLBACK_TTS_MODELS));
    // Only refresh model list on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    onChange({ ...state, [k]: v });

  const updateSpeaker = (idx: number, patch: Partial<SpeakerConfig>) => {
    const next = state.speakers.map((sp, i) => (i === idx ? { ...sp, ...patch } : sp));
    onChange({ ...state, speakers: next });
  };

  const selected = models.find((m) => m.id === state.model);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border-b border-border bg-panel/40">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tryb
        <button
          className={`field text-left ${state.multiSpeaker ? "text-accent2" : ""}`}
          onClick={() => update("multiSpeaker", !state.multiSpeaker)}
          type="button"
        >
          {state.multiSpeaker ? "Multi-speaker" : "Single-speaker"}
        </button>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
        Model TTS
        <select className="field" value={state.model} onChange={(e) => update("model", e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name} — {m.id}
            </option>
          ))}
        </select>
        {selected && (
          <span className="text-[10px] text-muted/80 truncate" title={selected.id}>
            API id: {selected.id}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Glos
        <select className="field" value={state.voice} onChange={(e) => update("voice", e.target.value)} disabled={state.multiSpeaker}>
          {voices.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted col-span-2 md:col-span-4">
        Styl (opcjonalny prompt sterujacy, np. "Powiedz to wesolo szeptem")
        <input
          className="field"
          value={state.style}
          onChange={(e) => update("style", e.target.value)}
          placeholder='np. Say in a spooky whisper: lub "Powiedz to spokojnie:"'
        />
      </label>

      <VoiceSamples
        model={state.model}
        selectedVoice={state.voice}
        onSelectVoice={(voice) => update("voice", voice)}
        onError={onError ?? (() => undefined)}
      />

      {state.multiSpeaker && (
        <div className="col-span-2 md:col-span-4 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-[10px] text-muted">
            W trybie multi-speaker nazwy mówców w tekście muszą zgadzać się z polami poniżej (np. Mowca1:, Mowca2:).
          </p>
          {state.speakers.map((sp, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Nazwa mowcy {i + 1}
                <input className="field" value={sp.speaker} onChange={(e) => updateSpeaker(i, { speaker: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Glos {i + 1}
                <select className="field" value={sp.voice} onChange={(e) => updateSpeaker(i, { voice: e.target.value })}>
                  {voices.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}