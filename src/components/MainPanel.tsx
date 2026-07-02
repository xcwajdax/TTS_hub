import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generate, getAppSettings, setAppSettings, type VoiceBoxProfile } from "../api/tauri";

import { syncSaveFormatFromSettings } from "../audioFormats";

import {

  appSettingsViewToPayload,

  defaultTextFiltersSettings,

  resolveActivePreset,

  type TextFilterPreset,

  type TextFiltersSettings,

} from "../appSettings";

import { usePlayback } from "../context/PlaybackContext";

import { useJobs, useLatestJobProgress } from "../context/JobsContext";

import {

  VOICE_PROFILE_GENERATE_EVENT,

  type VoiceProfileGenerateDetail,

} from "../lib/voiceProfileActions";

import { touchVoiceProfilePreviews, resolveProfileForGeneration, voiceProfileToSettingsState } from "../lib/voiceProfiles";

import { ensureTextFiltersWithFactory } from "../lib/filterPresetCatalog";

import {
  applyTextFiltersForPreset,
} from "../lib/voiceoverBriefFilter";

import {

  EDITOR_OPEN_GENERATION_EVENT,

  EDITOR_TEXT_LOAD_EVENT,

  takePendingGenerationOpen,

  type EditorOpenGenerationDetail,

  type EditorTextLoadDetail,

} from "../lib/editorTextLoad";

import { loadTextFiltersSession, type TextFiltersSession } from "../lib/textFiltersSession";

import { isTauriApp } from "../lib/tauriEnv";
import { getMockAppSettingsView } from "../lib/mockUi";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";

import type { AudioFormat, Generation } from "../types";

import { EMPTY_DOC, isDocEmpty } from "./editor/types";

import GenerationCostHint from "./GenerationCostHint";

import type { SettingsState } from "./Settings";

import GenerationProgressBar from "./GenerationProgress";

import BlockEditorPane, {

  blockDocToSourceText,

  resolveFilterSourceText,

} from "./textFilters/BlockEditorPane";

import SynthTextPreview from "./textFilters/SynthTextPreview";

import TextFiltersBar, { type SettingsTab } from "./textFilters/TextFiltersBar";

import { useAppView } from "../context/AppViewContext";

import EditorTabBar from "./editorTabs/EditorTabBar";

import GenerateButton from "./editorTabs/GenerateButton";

import type { EditorTab } from "../lib/editorTabs/types";

import { findGenerationById } from "../lib/editorTabs/findGeneration";
import { useEditorTabs } from "../lib/editorTabs/useEditorTabs";
import { displayTitle } from "../lib/generationTitle";



export const VOICE_PROFILE_DELETED_TAB_EVENT = "tts-hub:voice-profile-deleted-tab";



interface Props {

  onGenerated: (g: Generation) => void;

  onError: (e: string) => void;

  settings: SettingsState;

  voiceboxProfiles: VoiceBoxProfile[];

  activeVoiceProfileId: string | null;

  onVoiceProfileChange: (profileId: string | null) => void;

}



export default function MainPanel({

  onGenerated,

  onError,

  settings,

  voiceboxProfiles,

  activeVoiceProfileId,

  onVoiceProfileChange,

}: Props) {

  const { editorText, setEditorText, select } = usePlayback();

  const { trackEnqueued, activeJobs, jobs, latestId } = useJobs();

  const progress = useLatestJobProgress();

  const lastReportedJobErrorRef = useRef<string | null>(null);

  const [enqueuing, setEnqueuing] = useState(false);

  const initialPlainSyncedRef = useRef(false);

  const tabActivatedRef = useRef(false);

  const { openSettingsTab, goToView } = useAppView();



  const [textFilters, setTextFilters] = useState<TextFiltersSettings>(defaultTextFiltersSettings);

  const [filterSession] = useState<TextFiltersSession>(() => loadTextFiltersSession());

  const [appSettingsSnapshot, setAppSettingsSnapshot] = useState<Awaited<

    ReturnType<typeof getAppSettings>

  > | null>(null);

  const [toast, setLocalToast] = useState<string | null>(null);

  const [contextLabel, setContextLabel] = useState(() => {
    try {
      return localStorage.getItem("tts_context_label") ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (contextLabel.trim()) {
        localStorage.setItem("tts_context_label", contextLabel);
      } else {
        localStorage.removeItem("tts_context_label");
      }
    } catch {
      /* ignore */
    }
  }, [contextLabel]);



  const textFiltersRef = useRef(textFilters);

  textFiltersRef.current = textFilters;

  const activeVoiceProfileIdRef = useRef(activeVoiceProfileId);

  activeVoiceProfileIdRef.current = activeVoiceProfileId;

  const ignoreNextProfileSyncRef = useRef(false);

  const voiceProfilesRef = useRef(appSettingsSnapshot?.voice_profiles ?? []);

  voiceProfilesRef.current = appSettingsSnapshot?.voice_profiles ?? [];



  const activePreset = useMemo(() => resolveActivePreset(textFilters), [textFilters]);

  const defaultFilterPresetId = activePreset.id;



  const applyTabToUi = useCallback(

    async (tab: EditorTab) => {

      ignoreNextProfileSyncRef.current = true;

      setEditorText(blockDocToSourceText(tab.blockDoc));



      if (

        tab.filterPresetId &&

        tab.filterPresetId !== textFiltersRef.current.active_preset_id

      ) {

        setTextFilters((prev) => ({ ...prev, active_preset_id: tab.filterPresetId }));

      }



      const currentProfile = activeVoiceProfileIdRef.current;

      if (tab.voiceProfileId !== currentProfile) {

        onVoiceProfileChange(tab.voiceProfileId);

      }



      if (tab.generationId) {

        const g = await findGenerationById(tab.generationId);

        if (g) select(g, { loadEditorText: false, autoPlay: false });

      }

    },

    [onVoiceProfileChange, select, setEditorText],

  );



  const editorTabs = useEditorTabs({

    defaultFilterPresetId,

    onTabActivated: applyTabToUi,

  });


  const { activeTab, linkGenerationToActiveTab, loadTextIntoActiveTab, openGenerationInTab, clearVoiceProfileFromTabs } =

    editorTabs;



  const blockDoc = activeTab?.blockDoc ?? EMPTY_DOC;



  useEffect(() => {

    if (ignoreNextProfileSyncRef.current) {

      ignoreNextProfileSyncRef.current = false;

      return;

    }

    if (activeTab && activeTab.voiceProfileId !== activeVoiceProfileId) {

      editorTabs.updateActiveTab({ voiceProfileId: activeVoiceProfileId });

    }

  }, [activeVoiceProfileId, activeTab, editorTabs]);



  useEffect(() => {

    if (!toast) return;

    const id = window.setTimeout(() => setLocalToast(null), 3500);

    return () => window.clearTimeout(id);

  }, [toast]);



  const sourceText = useMemo(

    () => resolveFilterSourceText(blockDoc, activePreset, filterSession.builtinOverrides),

    [blockDoc, activePreset, filterSession.builtinOverrides],

  );



  const originalForPreview = useMemo(() => blockDocToSourceText(blockDoc), [blockDoc]);



  const filterResult = useMemo(

    () => applyTextFiltersForPreset(sourceText, activePreset, filterSession.builtinOverrides),

    [sourceText, activePreset, filterSession.builtinOverrides],

  );



  const persistTextFilters = useCallback(

    async (next: TextFiltersSettings) => {

      setTextFilters(next);

      if (next.active_preset_id) {

        editorTabs.updateActiveTab({ filterPresetId: next.active_preset_id });

      }

      if (!appSettingsSnapshot) return;

      try {

        await setAppSettings({

          ...appSettingsViewToPayload(appSettingsSnapshot),

          text_filters: next,

        });

        const view = await getAppSettings();

        setAppSettingsSnapshot(view);

      } catch (e) {

        onError(String(e));

      }

    },

    [appSettingsSnapshot, editorTabs, onError],

  );



  const onPresetUpdate = (preset: TextFilterPreset) => {

    const next: TextFiltersSettings = {

      ...textFilters,

      presets: textFilters.presets.map((p) => (p.id === preset.id ? preset : p)),

    };

    void persistTextFilters(next);

  };



  const openSettings = (tab: SettingsTab) => {

    openSettingsTab(tab);

  };



  const toggleSaveMode = async () => {

    if (!appSettingsSnapshot) {

      goToView("settings");

      return;

    }

    const nextMode = appSettingsSnapshot.save_mode === "auto" ? "manual" : "auto";

    try {

      const view = await setAppSettings({

        ...appSettingsViewToPayload(appSettingsSnapshot),

        save_mode: nextMode,

      });

      setAppSettingsSnapshot(view);

      setLocalToast(

        nextMode === "auto" ? "Autozapis włączony." : "Tryb ręcznego zapisu włączony.",

      );

    } catch (e) {

      onError(String(e));

    }

  };



  useEffect(() => {

    if (!latestId) return;

    const job = jobs[latestId];

    if (job?.status === "failed" && job.error?.trim()) {

      const key = `${latestId}:${job.error}`;

      if (lastReportedJobErrorRef.current === key) return;

      lastReportedJobErrorRef.current = key;

      onError(job.error);

    }

  }, [jobs, latestId, onError]);



  useEffect(() => {

    if (isMockUiMode()) {
      const view = getMockAppSettingsView();
      setAppSettingsSnapshot(view);
      setTextFilters(
        ensureTextFiltersWithFactory(view.text_filters ?? defaultTextFiltersSettings()),
      );
      return;
    }

    if (!isTauriApp()) return;

    void syncSaveFormatFromSettings();

    getAppSettings()

      .then((view) => {

        setAppSettingsSnapshot(view);

        setTextFilters(

          ensureTextFiltersWithFactory(view.text_filters ?? defaultTextFiltersSettings()),

        );

      })

      .catch((e) => onError(String(e)));

  }, [onError]);



  useEffect(() => {

    if (initialPlainSyncedRef.current) return;

    if (editorText.trim() && activeTab && isDocEmpty(activeTab.blockDoc)) {

      loadTextIntoActiveTab(editorText);

    }

    initialPlainSyncedRef.current = true;

  }, [editorText, activeTab, loadTextIntoActiveTab]);



  useEffect(() => {

    if (tabActivatedRef.current || !activeTab) return;

    tabActivatedRef.current = true;

    void applyTabToUi(activeTab);

  }, [activeTab, applyTabToUi]);



  useEffect(() => {

    const handleOpenGeneration = (g: Generation) => {

      takePendingGenerationOpen();

      void (async () => {

        let profiles = voiceProfilesRef.current;

        if (profiles.length === 0) {

          try {

            const view = await getAppSettings();

            profiles = view.voice_profiles ?? [];

          } catch {

            /* keep empty */

          }

        }

        const resolvedProfile = resolveProfileForGeneration(g, profiles);

        openGenerationInTab({

          text: g.text,

          generationId: g.id,

          voiceProfileId: resolvedProfile?.id ?? g.voice_profile_id ?? null,

          title: displayTitle(g),

        });

      })();

    };



    const pending = takePendingGenerationOpen();

    if (pending) handleOpenGeneration(pending);



    const onOpen = (ev: Event) => {

      const gen = (ev as CustomEvent<EditorOpenGenerationDetail>).detail?.generation;

      if (gen) handleOpenGeneration(gen);

    };



    const onLoad = (ev: Event) => {

      const detail = (ev as CustomEvent<EditorTextLoadDetail>).detail;

      const text = detail?.text ?? "";

      loadTextIntoActiveTab(text, detail?.generationId ?? null);

      setEditorText(text);

    };

    window.addEventListener(EDITOR_OPEN_GENERATION_EVENT, onOpen);

    window.addEventListener(EDITOR_TEXT_LOAD_EVENT, onLoad);

    return () => {

      window.removeEventListener(EDITOR_OPEN_GENERATION_EVENT, onOpen);

      window.removeEventListener(EDITOR_TEXT_LOAD_EVENT, onLoad);

    };

  }, [loadTextIntoActiveTab, openGenerationInTab, setEditorText]);



  useEffect(() => {

    const onProfileDeleted = (ev: Event) => {

      const profileId = (ev as CustomEvent<{ profileId: string }>).detail?.profileId;

      if (profileId) clearVoiceProfileFromTabs(profileId);

    };

    window.addEventListener(VOICE_PROFILE_DELETED_TAB_EVENT, onProfileDeleted);

    return () => window.removeEventListener(VOICE_PROFILE_DELETED_TAB_EVENT, onProfileDeleted);

  }, [clearVoiceProfileFromTabs]);



  const enqueueGeneration = async (

    tts: SettingsState,

    formatOverride: string | null,

    presetForFilter: TextFilterPreset,

    voiceProfileId?: string | null,

  ) => {

    if (isMockUiMode()) {
      onError("Tryb mockup — generowanie TTS jest wyłączone.");
      return;
    }

    const filtered = applyTextFiltersForPreset(

      sourceText,

      presetForFilter,

      filterSession.builtinOverrides,

    ).output.trim();



    const hasSource = blockDoc.blocks.some((b) => b.text.trim().length > 0);

    if (!hasSource || !filtered || enqueuing) {

      if (hasSource && !filtered) {

        onError("Po zastosowaniu filtrów nie zostaje tekst do syntezy.");

      }

      return;

    }



    setEnqueuing(true);

    const textSnapshot = blockDocToSourceText(blockDoc);

    const selectedVoiceboxProfile = voiceboxProfiles.find((p) => p.id === tts.voiceboxProfileId);

    const voiceboxEngine = tts.model.startsWith("voicebox:")

      ? tts.model.slice("voicebox:".length)

      : null;

    const rawFmt =

      formatOverride?.trim().toLowerCase() ||

      appSettingsSnapshot?.save_format ||

      "wav";

    const fmt: AudioFormat =

      rawFmt === "mp3" || rawFmt === "ogg" ? rawFmt : "wav";



    try {

      const g = await generate({

        text: textSnapshot,

        filtered_text: filtered,

        filter_config: presetForFilter,

        model: tts.model,

        voice:

          tts.provider === "voicebox"

            ? (selectedVoiceboxProfile?.name ?? tts.voiceboxProfileId)

            : tts.voice,

        style: tts.style.trim() || null,

        format: fmt,

        multi_speaker:

          tts.provider === "google" && tts.multiSpeaker ? tts.speakers : null,

        provider: tts.provider,

        profile_id: tts.provider === "voicebox" ? tts.voiceboxProfileId : null,

        language:

          tts.provider === "voicebox" || tts.provider === "minimax"

            ? tts.language

            : null,

        engine: tts.provider === "voicebox" ? voiceboxEngine : null,

        personality:

          tts.provider === "voicebox" && tts.voiceboxPersonalityEnabled ? true : null,

        minimax_speed: tts.provider === "minimax" ? tts.minimaxSpeed : null,

        minimax_vol: tts.provider === "minimax" ? tts.minimaxVol : null,

        minimax_pitch: tts.provider === "minimax" ? tts.minimaxPitch : null,

        minimax_options:

          tts.provider === "minimax"

            ? {

                ...tts.minimaxOptions,

                voice: {

                  ...tts.minimaxOptions.voice,

                  speed: tts.minimaxSpeed,

                  vol: tts.minimaxVol,

                  pitch: tts.minimaxPitch,

                },

                language: tts.language,

              }

            : null,

        voice_profile_id: voiceProfileId ?? activeVoiceProfileId ?? null,

        context_label: contextLabel.trim() || null,

      });

      trackEnqueued(g);

      void touchVoiceProfilePreviews(tts, filtered, voiceProfileId).catch(() => undefined);

      linkGenerationToActiveTab(g.id);

      select(g, { loadEditorText: false, autoPlay: false });

      onGenerated(g);

    } catch (e) {

      onError(String(e));

    } finally {

      setEnqueuing(false);

    }

  };



  const generateWithProfileRef = useRef<(profileId: string) => void>(() => undefined);



  generateWithProfileRef.current = (profileId: string) => {

    void (async () => {

      const view = await getAppSettings();

      const profile = view.voice_profiles?.find((p) => p.id === profileId);

      if (!profile) {

        onError("Nie znaleziono profilu głosu.");

        return;

      }

      const tts = voiceProfileToSettingsState(profile);

      const presetForFilter: TextFilterPreset = {

        ...activePreset,

        builtins: { ...activePreset.builtins, ...filterSession.builtinOverrides },

      };

      await enqueueGeneration(tts, null, presetForFilter, profile.id);

    })();

  };



  useEffect(() => {

    const onProfileGenerate = (ev: Event) => {

      const profileId = (ev as CustomEvent<VoiceProfileGenerateDetail>).detail?.profileId;

      if (!profileId) return;

      generateWithProfileRef.current(profileId);

    };

    window.addEventListener(VOICE_PROFILE_GENERATE_EVENT, onProfileGenerate);

    return () => window.removeEventListener(VOICE_PROFILE_GENERATE_EVENT, onProfileGenerate);

  }, []);



  const onGenerate = async () => {

    await enqueueGeneration(settings, null, {

      ...activePreset,

      builtins: { ...activePreset.builtins, ...filterSession.builtinOverrides },

    });

  };



  const showProgress = progress.active || progress.phase === "done" || progress.failed;

  const synthPreviewVisible =
    originalForPreview.trim() !== filterResult.output.trim() ||
    filterResult.warnings.length > 0;

  const showPreviewSection = synthPreviewVisible || showProgress;

  const queuedCount = activeJobs.filter((j) => j.status === "queued").length;

  const runningCount = activeJobs.filter((j) => j.status === "running").length;

  const activeBadge =

    activeJobs.length > 0 ? `${runningCount} w toku · ${queuedCount} w kolejce` : null;



  const canGenerate =

    blockDoc.blocks.some((b) => b.text.trim().length > 0) && filterResult.output.trim().length > 0;



  const hasGeneration = Boolean(activeTab?.generationId);

  const queueHint =

    activeJobs.length > 0 ? `${activeJobs.length} w kolejce` : undefined;



  return (

    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      <EditorTabBar

        tabsApi={editorTabs}

        trailing={

          <>

            {activeBadge && (

              <span className="text-[11px] px-2 py-0.5 bg-panel2 border border-border text-muted whitespace-nowrap">

                {activeBadge}

              </span>

            )}

            {settings.provider === "google" && (

              <GenerationCostHint

                model={settings.model}

                synthCharCount={filterResult.output.trim().length}

                className="hidden lg:inline"

              />

            )}

          </>

        }

      />



      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {showPreviewSection ? (
          <div className="shrink-0 px-4 pt-3 pb-2 space-y-2">
            {synthPreviewVisible ? (
              <SynthTextPreview
                original={originalForPreview}
                filtered={filterResult.output}
                warnings={filterResult.warnings}
                activePresetId={activePreset.id}
              />
            ) : null}

            <div
              className={`grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-out ${
                showProgress ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <GenerationProgressBar progress={progress} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" data-tour="editor">
          <div className="shrink-0 px-4">

            <TextFiltersBar

              settings={textFilters}

              activePreset={activePreset}

              ttsSettings={settings}

              activeVoiceProfileId={activeVoiceProfileId}

              saveMode={appSettingsSnapshot?.save_mode ?? "manual"}

              saveFormat={appSettingsSnapshot?.save_format ?? "wav"}

              onSettingsChange={(next) => void persistTextFilters(next)}

              onPresetUpdate={onPresetUpdate}

              onOpenSettings={openSettings}

              onSaveModeToggle={() => void toggleSaveMode()}

            />

          </div>

          <BlockEditorPane

            key={editorTabs.activeTabId}

            blockDoc={blockDoc}

            onBlockDocChange={(doc) => {

              editorTabs.updateActiveTab({ blockDoc: doc });

              setEditorText(blockDocToSourceText(doc));

            }}

            onEnterWithCtrl={() => void onGenerate()}

            footerAction={

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 w-full sm:w-auto">

                <label className="flex flex-col gap-0.5 text-[10px] text-muted min-w-0 flex-1 sm:max-w-[14rem]">

                  Kontekst / projekt

                  <input

                    className="field text-xs py-1"

                    value={contextLabel}

                    onChange={(e) => setContextLabel(e.target.value)}

                    placeholder="np. Film promocyjny"

                    title="Opcjonalna etykieta sesji lub projektu — badge w historii, bez zmiany tytułu"

                  />

                </label>

                <GenerateButton

                  enqueuing={enqueuing}

                  canGenerate={canGenerate}

                  hasGeneration={hasGeneration}

                  queueHint={queueHint}

                  onGenerate={onGenerate}

                />

              </div>

            }

            placeholder="Wklej lub wpisz tekst do syntezy mowy…"

          />

        </div>

      </div>



      {toast && (

        <div

          className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"

          onClick={() => setLocalToast(null)}

          title="Kliknij aby zamknac"

        >

          {toast}

        </div>

      )}

    </div>

  );

}


