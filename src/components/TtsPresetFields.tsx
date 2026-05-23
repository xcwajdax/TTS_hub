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

  minimaxLanguageLabel,

  pickMinimaxVoiceForLanguage,

} from "../lib/minimaxLanguages";

import { DEFAULT_TTS_MODEL, FALLBACK_TTS_MODELS, type TtsModelInfo } from "../ttsModels";

import type { TtsProvider } from "../types";

import type { SettingsState } from "./Settings";

import VoiceSamples from "./VoiceSamples";



const FALLBACK_VOICEBOX_MODELS: TtsModelInfo[] = [

  { id: "voicebox:chatterbox", display_name: "Voice Box Chatterbox" },

];

const DEFAULT_MINIMAX_MODEL = "minimax:speech-2.8-hd";



interface Props {

  state: SettingsState;

  voices: string[];

  voiceboxProfiles: VoiceBoxProfile[];

  voiceboxModels: TtsModelInfo[];

  voiceboxHealth: VoiceBoxHealth | null;

  onChange: (s: SettingsState) => void;

  onError?: (message: string) => void;

  compact?: boolean;

}



export default function TtsPresetFields({

  state,

  voices,

  voiceboxProfiles,

  voiceboxModels,

  voiceboxHealth: _voiceboxHealth,

  onChange,

  onError,

  compact = false,

}: Props) {

  const [models, setModels] = useState<TtsModelInfo[]>(FALLBACK_TTS_MODELS);

  const [minimaxModels, setMinimaxModels] = useState<MinimaxModelInfo[]>([]);

  const [minimaxPresets, setMinimaxPresets] = useState<MinimaxPresetVoice[]>([]);

  const [minimaxCloned, setMinimaxCloned] = useState<MinimaxClonedVoice[]>([]);

  const [minimaxLanguages, setMinimaxLanguages] = useState<MinimaxLanguageInfo[]>([]);

  const [minimaxEnabledLangs, setMinimaxEnabledLangs] = useState<string[]>([DEFAULT_MINIMAX_LANGUAGE]);

  const [minimaxStatus, setMinimaxStatus] = useState<MinimaxHealth | null>(null);

  const [minimaxSyncedAt, setMinimaxSyncedAt] = useState<number | null>(null);

  const [syncingVoices, setSyncingVoices] = useState(false);



  useEffect(() => {

    listModels()

      .then((apiModels) => {

        if (apiModels.length === 0) return;

        setModels(apiModels);

      })

      .catch(() => setModels(FALLBACK_TTS_MODELS));

  }, []);



  useEffect(() => {

    if (state.provider !== "minimax") return;

    listMinimaxModels().then(setMinimaxModels).catch(() => setMinimaxModels([]));

    listMinimaxPresetVoices().then(setMinimaxPresets).catch(() => setMinimaxPresets([]));

    listMinimaxClonedVoices().then(setMinimaxCloned).catch(() => setMinimaxCloned([]));

    listMinimaxLanguages().then(setMinimaxLanguages).catch(() => setMinimaxLanguages([]));

    getAppSettings()

      .then((view) => {

        setMinimaxEnabledLangs(

          effectiveMinimaxEnabledLanguages(view.minimax_enabled_languages),

        );

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

  }, [

    state.provider,

    minimaxPresets,

    minimaxCloned,

    state.language,

    state.voice,

    clonedVoiceIds,

    state,

    onChange,

  ]);



  const update = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>

    onChange({ ...state, [k]: v });



  const updateMinimaxLanguage = (languageCode: string) => {

    const voice = pickMinimaxVoiceForLanguage(

      minimaxPresets,

      languageCode,

      state.voice,

      clonedVoiceIds,

    );

    onChange({ ...state, language: languageCode, voice });

  };



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



  const switchProvider = (provider: TtsProvider) => {

    if (provider === state.provider) return;

    if (provider === "voicebox") {

      const model = (voiceboxModels[0] ?? FALLBACK_VOICEBOX_MODELS[0]).id;

      const profile = voiceboxProfiles[0];

      onChange({

        ...state,

        provider,

        model,

        voice: profile?.name ?? state.voice,

        voiceboxProfileId: profile?.id ?? state.voiceboxProfileId,

        language: profile?.language ?? state.language,

      });

      return;

    }

    if (provider === "minimax") {

      const model = minimaxModelOptions[0]?.id ?? DEFAULT_MINIMAX_MODEL;

      const lang = minimaxLangOptions[0]?.code ?? DEFAULT_MINIMAX_LANGUAGE;

      const voice = pickMinimaxVoiceForLanguage(

        minimaxPresets,

        lang,

        state.voice,

        clonedVoiceIds,

      );

      onChange({

        ...state,

        provider,

        model,

        language: lang,

        voice,

      });

      return;

    }

    onChange({

      ...state,

      provider,

      model: models.find((m) => m.id === DEFAULT_TTS_MODEL)?.id ?? DEFAULT_TTS_MODEL,

      voice: voices.includes(state.voice) ? state.voice : "Kore",

    });

  };



  const updateVoiceboxProfile = (profileId: string) => {

    const profile = voiceboxProfiles.find((p) => p.id === profileId);

    onChange({

      ...state,

      voiceboxProfileId: profileId,

      voice: profile?.name ?? profileId,

      language: profile?.language ?? state.language,

    });

  };



  const minimaxPresetsForPicker = minimaxSyncedAt ? minimaxPresets : minimaxPresetsForLang;

  const minimaxVoiceOptions = [

    ...minimaxPresetsForPicker.map((v) => ({ id: v.voice_id, label: v.display_name })),

    ...minimaxCloned.map((v) => ({ id: v.voice_id, label: `${v.name} (klon)` })),

  ];



  const gridClass = compact

    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"

    : "grid grid-cols-2 md:grid-cols-4 gap-3";



  return (

    <div className={`${gridClass} text-xs`}>

      <label className="flex flex-col gap-1 text-muted">

        Provider

        <select className="field" value={state.provider} onChange={(e) => switchProvider(e.target.value as TtsProvider)}>

          <option value="google">Google Gemini</option>

          <option value="voicebox">Voice Box</option>

          <option value="minimax">Minimax Portal</option>

        </select>

      </label>



      <label className="flex flex-col gap-1 text-muted sm:col-span-1">

        Model TTS

        <select className="field" value={state.model} onChange={(e) => update("model", e.target.value)}>

          {activeModels.map((m) => (

            <option key={m.id} value={m.id}>

              {m.display_name}

            </option>

          ))}

        </select>

      </label>



      {state.provider === "minimax" && (

        <label className="flex flex-col gap-1 text-muted">

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



      <label className="flex flex-col gap-1 text-muted sm:col-span-2">

        {state.provider === "voicebox" ? "Profil" : state.provider === "minimax" ? "Głos" : "Głos"}

        {state.provider === "voicebox" ? (

          <select className="field" value={state.voiceboxProfileId} onChange={(e) => updateVoiceboxProfile(e.target.value)}>

            {voiceboxProfiles.map((p) => (

              <option key={p.id} value={p.id}>

                {p.name} · {p.language}

              </option>

            ))}

          </select>

        ) : state.provider === "minimax" ? (

          <select className="field" value={state.voice} onChange={(e) => update("voice", e.target.value)}>

            {minimaxVoiceOptions.map((v) => (

              <option key={v.id} value={v.id}>

                {v.label}

              </option>

            ))}

          </select>

        ) : (

          <VoiceSamples

            model={state.model}

            selectedVoice={state.voice}

            onSelectVoice={(voice) => update("voice", voice)}

            onError={onError ?? (() => undefined)}

            disabled={false}

          />

        )}

      </label>



      {state.provider === "voicebox" && (

        <label className="flex flex-col gap-1 text-muted">

          Język

          <input className="field" value={state.language} onChange={(e) => update("language", e.target.value)} placeholder="pl" />

        </label>

      )}



      {state.provider === "minimax" ? (

        <label className="flex flex-col gap-1 text-muted">

          Tempo (speed)

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

      ) : (

        <p className="text-[10px] text-muted sm:col-span-2 self-end pb-1">

          Tempo mowy: niedostępne u tego providera (tylko Minimax).

        </p>

      )}



      {state.provider === "minimax" && (

        <>

          <label className="flex flex-col gap-1 text-muted">

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

          <label className="flex flex-col gap-1 text-muted">

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

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">

            <p className="text-[10px] text-muted/80 flex-1 min-w-[12rem]">

              {minimaxStatus?.message ?? ""}

              {state.language

                ? ` · language_boost=${minimaxLanguages.find((l) => l.code === state.language)?.language_boost ?? minimaxLanguageLabel(state.language)}`

                : ""}

              {minimaxSyncedAt

                ? ` · sync ${new Date(minimaxSyncedAt * 1000).toLocaleString("pl-PL")}`

                : ""}

            </p>

            <button

              type="button"

              className="btn text-[10px] px-2 py-1"

              disabled={syncingVoices || !minimaxStatus?.configured}

              onClick={() => {

                void (async () => {

                  setSyncingVoices(true);

                  try {

                    await syncMinimaxVoices();

                    const [presets, cloned, view] = await Promise.all([

                      listMinimaxPresetVoices(),

                      listMinimaxClonedVoices(),

                      getAppSettings(),

                    ]);

                    setMinimaxPresets(presets);

                    setMinimaxCloned(cloned);

                    setMinimaxSyncedAt(view.minimax_voices_synced_at ?? null);

                  } catch (e) {

                    onError?.(String(e));

                  } finally {

                    setSyncingVoices(false);

                  }

                })();

              }}

            >

              {syncingVoices ? "Sync…" : "Sync głosów"}

            </button>

          </div>

        </>

      )}



      <label className="flex flex-col gap-1 text-muted sm:col-span-2">

        Styl (prompt)

        <input

          className="field"

          value={state.style}

          onChange={(e) => update("style", e.target.value)}

          placeholder='np. "Powiedz spokojnie po polsku:"'

          disabled={state.provider === "minimax"}

          title={

            state.provider === "minimax"

              ? "Minimax: wybór głosu i języka (language_boost). Pole stylu jak u Gemini nie jest wspierane 1:1."

              : undefined

          }

        />

        {state.provider === "minimax" && (

          <span className="text-[10px] text-muted/80">

            Minimax steruje brzmieniem przez głos i language_boost, nie przez osobny prompt stylu.

          </span>

        )}

      </label>

    </div>

  );

}


