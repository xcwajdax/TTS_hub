import { useEffect, useState } from "react";

import type { TtsProviderId } from "../../appSettings";

import Settings, { type SettingsState } from "../Settings";

import type { VoiceBoxHealth, VoiceBoxProfile } from "../../api/tauri";

import type { TtsModelInfo } from "../../ttsModels";

import UnavailableFieldsPanel from "./fields/UnavailableFieldsPanel";

import "./voiceProfileForm.css";



const ADVANCED_STORAGE_KEY = "tts-hub:voice-profile-advanced";



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



export default function VoiceProfileEditor({

  state,

  voices,

  voiceboxProfiles,

  voiceboxModels,

  voiceboxHealth,

  enabledProviders,

  onChange,

  onError,

}: Props) {

  const [advancedMode, setAdvancedMode] = useState(() => {

    try {

      return localStorage.getItem(ADVANCED_STORAGE_KEY) === "1";

    } catch {

      return false;

    }

  });



  useEffect(() => {

    try {

      localStorage.setItem(ADVANCED_STORAGE_KEY, advancedMode ? "1" : "0");

    } catch {

      /* ignore */

    }

  }, [advancedMode]);



  return (

    <div className="flex flex-col min-h-0 h-full">

      <div className="shrink-0 px-3 pt-2 pb-2 flex items-center justify-between gap-2 border-b border-border/60 vp-form__item">

        <span className="text-[10px] uppercase tracking-wide text-muted">Tryb konfiguracji</span>

        <div className="vp-mode-toggle" role="group" aria-label="Tryb konfiguracji">

          <button

            type="button"

            aria-pressed={!advancedMode}

            onClick={() => setAdvancedMode(false)}

          >

            Podstawowy

          </button>

          <button

            type="button"

            aria-pressed={advancedMode}

            onClick={() => setAdvancedMode(true)}

          >

            Zaawansowany

          </button>

        </div>

      </div>



      <div className="flex-1 min-h-0 overflow-y-auto">

        <Settings

          state={state}

          voices={voices}

          voiceboxProfiles={voiceboxProfiles}

          voiceboxModels={voiceboxModels}

          voiceboxHealth={voiceboxHealth}

          enabledProviders={enabledProviders}

          onChange={onChange}

          onError={onError}

          showProviderPicker

          advancedMode={advancedMode}

          enhancedFields

        />

        <div className="px-3 pb-3 max-w-[42rem]">

          <UnavailableFieldsPanel provider={state.provider} advancedMode={advancedMode} />

        </div>

      </div>

    </div>

  );

}

