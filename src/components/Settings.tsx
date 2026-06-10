import { useEffect, useMemo, useState } from "react";
import {
  getAppSettings,
  listMinimaxClonedVoices,
  listMinimaxLanguages,
  listMinimaxModels,
  listMinimaxPresetVoices,
  listModels,
  minimaxHealth,
  syncMinimaxVoices,
  type MinimaxClonedVoice,
  type MinimaxHealth,
  type MinimaxLanguageInfo,
  type MinimaxModelInfo,
  type MinimaxPresetVoice,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import { DEFAULT_MINIMAX_LANGUAGE } from "../appSettings";
import {
  effectiveMinimaxEnabledLanguages,
  filterMinimaxPresetsByLanguage,
  pickMinimaxVoiceForLanguage,
} from "../lib/minimaxLanguages";
import { DEFAULT_TTS_MODEL, FALLBACK_TTS_MODELS, type TtsModelInfo } from "../ttsModels";
import { isProviderEnabled, type TtsProviderId } from "../appSettings";
import type { SpeakerConfig, TtsModel, TtsProvider } from "../types";
import MinimaxCloneVolumeControl from "./MinimaxCloneVolumeControl";
import VoiceSamplePlayButton from "./VoiceSamplePlayButton";
import VoiceSamples from "./VoiceSamples";
import { PROVIDER_TABS } from "../lib/providerSwitch";

export interface SettingsState {
  provider: TtsProvider;
  model: TtsModel;
  voice: string;
  voiceboxProfileId: string;
  language: string;
  style: string;
  multiSpeaker: boolean;
  speakers: SpeakerConfig[];
  minimaxSpeed: number;
  minimaxVol: number;
  minimaxPitch: number;
}

interface Props {
  state: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  enabledProviders?: TtsProviderId[];
  onChange: (s: SettingsState) => void;
  onError?: (message: string) => void;
}

const FALLBACK_VOICEBOX_MODELS: TtsModelInfo[] = [
  { id: "voicebox:chatterbox", display_name: "Voice Box Chatterbox" },
];

const DEFAULT_MINIMAX_MODEL = "minimax:speech-2.8-hd";

export default function Settings({
  state,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  enabledProviders,
  onChange,
  onError,
}: Props) {
  const providerOptions = PROVIDER_TABS.filter((o) =>
    isProviderEnabled(enabledProviders, o.id),
  );
  const visibleProviders =
    providerOptions.length > 0 ? providerOptions : PROVIDER_TABS;

  useEffect(() => {
    if (!visibleProviders.some((o) => o.id === state.provider)) {
      onChange({ ...state, provider: visibleProviders[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledProviders?.join(",")]);
  const [models, setModels] = useState<TtsModelInfo[]>(FALLBACK_TTS_MODELS);
  const [minimaxModels, setMinimaxModels] = useState<MinimaxModelInfo[]>([]);
  const [minimaxPresets, setMinimaxPresets] = useState<MinimaxPresetVoice[]>([]);
  const [minimaxCloned, setMinimaxCloned] = useState<MinimaxClonedVoice[]>([]);
  const [minimaxLanguages, setMinimaxLanguages] = useState<MinimaxLanguageInfo[]>([]);
  const [minimaxEnabledLangs, setMinimaxEnabledLangs] = useState<string[]>([DEFAULT_MINIMAX_LANGUAGE]);
  const [minimaxStatus, setMinimaxStatus] = useState<MinimaxHealth | null>(null);
  const [minimaxSyncedAt, setMinimaxSyncedAt] = useState<number | null>(null);
  const [syncingVoices, setSyncingVoices] = useState(false);
  const reloadMinimaxVoices = () => {
    listMinimaxPresetVoices().then(setMinimaxPresets).catch(() => setMinimaxPresets([]));
    listMinimaxClonedVoices().then(setMinimaxCloned).catch(() => setMinimaxCloned([]));
    getAppSettings()
      .then((view) => setMinimaxSyncedAt(view.minimax_voices_synced_at ?? null))
      .catch(() => setMinimaxSyncedAt(null));
  };

  useEffect(() => {
    listModels()
      .then((apiModels) => {
        if (apiModels.length === 0) return;
        setModels(apiModels);
        const ids = new Set(apiModels.map((m) => m.id));
        if (state.provider === "google" && !ids.has(state.model)) {
          const preferred = apiModels.find((m) => m.id === DEFAULT_TTS_MODEL) ?? apiModels[0];
          onChange({ ...state, model: preferred.id });
        }
      })
      .catch(() => setModels(FALLBACK_TTS_MODELS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.provider !== "minimax") return;
    listMinimaxModels().then(setMinimaxModels).catch(() => setMinimaxModels([]));
    listMinimaxPresetVoices().then(setMinimaxPresets).catch(() => setMinimaxPresets([]));
    listMinimaxClonedVoices().then(setMinimaxCloned).catch(() => setMinimaxCloned([]));
    listMinimaxLanguages().then(setMinimaxLanguages).catch(() => setMinimaxLanguages([]));
    getAppSettings()
      .then((view) => {
        setMinimaxEnabledLangs(effectiveMinimaxEnabledLanguages(view.minimax_enabled_languages));
        setMinimaxSyncedAt(view.minimax_voices_synced_at ?? null);
      })
      .catch(() => {
        setMinimaxEnabledLangs([DEFAULT_MINIMAX_LANGUAGE]);
        setMinimaxSyncedAt(null);
      });
    minimaxHealth().then(setMinimaxStatus).catch(() => setMinimaxStatus(null));
  }, [state.provider]);

  const minimaxLangOptions = useMemo(() => {
    const enabled = new Set(minimaxEnabledLangs);
    return minimaxLanguages.filter((l) => enabled.has(l.code));
  }, [minimaxLanguages, minimaxEnabledLangs]);

  const clonedVoiceIds = useMemo(
    () => new Set(minimaxCloned.map((v) => v.voice_id)),
    [minimaxCloned],
  );

  const minimaxPresetsForLang = useMemo(
    () => filterMinimaxPresetsByLanguage(minimaxPresets, state.language || DEFAULT_MINIMAX_LANGUAGE),
    [minimaxPresets, state.language],
  );

  useEffect(() => {
    if (state.provider !== "minimax") return;
    const validVoiceIds = new Set([
      ...minimaxPresets.map((v) => v.voice_id),
      ...minimaxCloned.map((v) => v.voice_id),
    ]);
    if (validVoiceIds.size === 0) return;
    const nextVoice = pickMinimaxVoiceForLanguage(
      minimaxPresets,
      state.language || DEFAULT_MINIMAX_LANGUAGE,
      state.voice,
      clonedVoiceIds,
    );
    if (nextVoice !== state.voice) {
      onChange({ ...state, voice: nextVoice });
    }
  }, [state.provider, minimaxPresets, minimaxCloned, state.language, state.voice, clonedVoiceIds, onChange]);

  const update = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    onChange({ ...state, [k]: v });

  const minimaxModelOptions: TtsModelInfo[] = useMemo(
    () =>
      minimaxModels.map((m) => ({
        id: `minimax:${m.id}`,
        display_name: m.display_name,
      })),
    [minimaxModels],
  );

  const activeModels =
    state.provider === "voicebox"
      ? voiceboxModels.length > 0
        ? voiceboxModels
        : FALLBACK_VOICEBOX_MODELS
      : state.provider === "minimax"
        ? minimaxModelOptions.length > 0
          ? minimaxModelOptions
          : [{ id: DEFAULT_MINIMAX_MODEL, display_name: "Speech 2.8 HD" }]
        : models;

  const selected = activeModels.find((m) => m.id === state.model);
  const selectedVoiceboxProfile = voiceboxProfiles.find((p) => p.id === state.voiceboxProfileId);

  const voiceboxStatusLabel = useMemo(() => {
    if (!voiceboxHealth) return "Voice Box niedostepny";
    const gpu = voiceboxHealth.gpu_type ?? (voiceboxHealth.gpu_available ? "GPU" : "CPU");
    const loaded = voiceboxHealth.model_loaded ? "model loaded" : "model not loaded";
    return `Voice Box ${voiceboxHealth.status} · ${gpu} · ${loaded}`;
  }, [voiceboxHealth]);

  const minimaxStatusLabel = minimaxStatus?.message ?? "Minimax — sprawdzanie…";

  const updateVoiceboxProfile = (profileId: string) => {
    const profile = voiceboxProfiles.find((p) => p.id === profileId);
    onChange({
      ...state,
      voiceboxProfileId: profileId,
      voice: profile?.name ?? profileId,
      language: profile?.language ?? state.language,
    });
  };

  const updateSpeaker = (idx: number, patch: Partial<SpeakerConfig>) => {
    const next = state.speakers.map((sp, i) => (i === idx ? { ...sp, ...patch } : sp));
    onChange({ ...state, speakers: next });
  };

  const updateMinimaxLanguage = (languageCode: string) => {
    const voice = pickMinimaxVoiceForLanguage(
      minimaxPresets,
      languageCode,
      state.voice,
      clonedVoiceIds,
    );
    onChange({ ...state, language: languageCode, voice });
  };

  const minimaxPresetsForPicker = minimaxSyncedAt ? minimaxPresets : minimaxPresetsForLang;

  const minimaxVoiceOptions = [
    ...minimaxPresetsForPicker.map((v) => ({ id: v.voice_id, label: v.display_name })),
    ...minimaxCloned.map((v) => ({ id: v.voice_id, label: `${v.name} (klon)` })),
  ];

  const runSyncMinimaxVoices = async () => {
    if (syncingVoices) return;
    setSyncingVoices(true);
    try {
      await syncMinimaxVoices();
      reloadMinimaxVoices();
    } catch (e) {
      onError?.(String(e));
    } finally {
      setSyncingVoices(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 p-3 bg-panel/40">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tryb
        <button
          className={`field text-left ${state.multiSpeaker ? "text-accent2" : ""}`}
          onClick={() => update("multiSpeaker", state.provider === "google" ? !state.multiSpeaker : false)}
          type="button"
          disabled={state.provider !== "google"}
        >
          {state.multiSpeaker ? "Multi-speaker" : "Single-speaker"}
        </button>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Model TTS
        <select className="field" value={state.model} onChange={(e) => update("model", e.target.value)}>
          {activeModels.map((m) => (
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
        {state.provider === "voicebox" ? "Profil" : state.provider === "minimax" ? "Głos (voice_id)" : "Glos"}
        {state.provider === "voicebox" ? (
          <select className="field" value={state.voiceboxProfileId} onChange={(e) => updateVoiceboxProfile(e.target.value)}>
            {voiceboxProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.language}
              </option>
            ))}
          </select>
        ) : state.provider === "minimax" ? (
          <div className="flex flex-col gap-2">
            <select className="field" value={state.voice} onChange={(e) => update("voice", e.target.value)}>
              {minimaxVoiceOptions.length === 0 ? (
                <option value={state.voice}>{state.voice}</option>
              ) : (
                minimaxVoiceOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))
              )}
            </select>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="btn text-xs w-full"
                disabled={syncingVoices || !minimaxStatus?.configured}
                onClick={() => void runSyncMinimaxVoices()}
              >
                {syncingVoices ? "Synchronizuję głosy…" : "Synchronizuj głosy z API"}
              </button>
            </div>
          </div>
        ) : (
          <VoiceSamples
            model={state.model}
            selectedVoice={state.voice}
            onSelectVoice={(voice) => update("voice", voice)}
            onError={onError ?? (() => undefined)}
            disabled={state.multiSpeaker}
          />
        )}
        {state.provider === "voicebox" && (
          <span className="text-[10px] text-muted/80 truncate" title={selectedVoiceboxProfile?.id}>
            {selectedVoiceboxProfile ? selectedVoiceboxProfile.id : "Brak profili Voice Box"}
          </span>
        )}
        {state.provider === "minimax" && (
          <span className="text-[10px] text-muted/80 truncate" title={minimaxStatusLabel}>
            {minimaxStatusLabel}
            {minimaxSyncedAt
              ? ` · zsynchronizowano ${new Date(minimaxSyncedAt * 1000).toLocaleString("pl-PL")}`
              : " · wbudowany katalog (użyj synchronizacji)"}
          </span>
        )}
      </label>

      {state.provider === "voicebox" && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Jezyk
          <input className="field" value={state.language} onChange={(e) => update("language", e.target.value)} placeholder="pl" />
          <span className="text-[10px] text-muted/80 truncate" title={voiceboxStatusLabel}>
            {voiceboxStatusLabel}
          </span>
        </label>
      )}

      {state.provider === "minimax" && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Język
          <select
            className="field"
            value={state.language || DEFAULT_MINIMAX_LANGUAGE}
            onChange={(e) => updateMinimaxLanguage(e.target.value)}
          >
            {minimaxLangOptions.map((l) => (
              <option key={l.code} value={l.code}>
                {l.display_name}
              </option>
            ))}
          </select>
        </label>
      )}

      {state.provider === "minimax" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Speed
            <input
              className="field"
              type="number"
              min={0.5}
              max={2}
              step={0.1}
              value={state.minimaxSpeed}
              onChange={(e) => update("minimaxSpeed", Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Vol
            <input
              className="field"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={state.minimaxVol}
              onChange={(e) => update("minimaxVol", Number(e.target.value) || 1)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Pitch
            <input
              className="field"
              type="number"
              min={-12}
              max={12}
              step={1}
              value={state.minimaxPitch}
              onChange={(e) => update("minimaxPitch", Number(e.target.value) || 0)}
            />
          </label>
          {clonedVoiceIds.has(state.voice) && (
            <MinimaxCloneVolumeControl
              voiceId={state.voice}
              presetVol={state.minimaxVol}
              cloned={minimaxCloned}
              onClonedUpdated={(v) =>
                setMinimaxCloned((prev) =>
                  prev.map((c) => (c.voice_id === v.voice_id ? v : c)),
                )
              }
              onError={onError}
            />
          )}
        </>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted">
        Styl (opcjonalny prompt sterujacy, np. "Powiedz to wesolo szeptem")
        <input
          className="field"
          value={state.style}
          onChange={(e) => update("style", e.target.value)}
          placeholder='np. Say in a spooky whisper: lub "Powiedz to spokojnie:"'
          disabled={state.provider === "minimax"}
        />
      </label>

      {state.provider === "voicebox" && (
        <div className="text-[10px] text-muted">
          Probki Gemini sa ukryte dla Voice Box. Profile Voice Box korzystaja z probek zapisanych w lokalnym serwerze.
        </div>
      )}

      {state.provider === "google" && state.multiSpeaker && (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-[10px] text-muted">
            W trybie multi-speaker nazwy mówców w tekście muszą zgadzać się z polami poniżej (np. Mowca1:, Mowca2:).
          </p>
          {state.speakers.map((sp, i) => (
            <div key={i} className="grid grid-cols-1 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Nazwa mowcy {i + 1}
                <input className="field" value={sp.speaker} onChange={(e) => updateSpeaker(i, { speaker: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Glos {i + 1}
                <div className="flex items-stretch gap-1">
                  <select
                    className="field flex-1 min-w-0"
                    value={sp.voice}
                    onChange={(e) => updateSpeaker(i, { voice: e.target.value })}
                  >
                    {voices.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <VoiceSamplePlayButton
                    model={state.model}
                    voice={sp.voice}
                    onError={onError ?? (() => undefined)}
                  />
                </div>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
