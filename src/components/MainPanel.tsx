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
import { touchVoiceProfilePreviews, voiceProfileToSettingsState } from "../lib/voiceProfiles";
import { ensureTextFiltersWithFactory } from "../lib/filterPresetCatalog";
import { applyTextFilters } from "../lib/textFilters";
import {
  EDITOR_TEXT_LOAD_EVENT,
  type EditorTextLoadDetail,
} from "../lib/editorTextLoad";
import { loadTextFiltersSession, type TextFiltersSession } from "../lib/textFiltersSession";
import { isTauriApp } from "../lib/tauriEnv";
import type { AudioFormat, Generation } from "../types";
import type { BlockDoc } from "./editor/types";
import { EMPTY_DOC } from "./editor/types";
import GenerationCostHint from "./GenerationCostHint";
import type { SettingsState } from "./Settings";
import GenerationProgressBar from "./GenerationProgress";
import BlockEditorPane, {
  blockDocToFilteredBase,
  blockDocToSourceText,
  plainTextToBlockDoc,
} from "./textFilters/BlockEditorPane";
import SynthTextPreview from "./textFilters/SynthTextPreview";
import TextFiltersBar, { type SettingsTab } from "./textFilters/TextFiltersBar";
import { useAppView } from "../context/AppViewContext";

interface Props {
  onGenerated: (g: Generation) => void;
  onError: (e: string) => void;
  settings: SettingsState;
  voiceboxProfiles: VoiceBoxProfile[];
  activeVoiceProfileId: string | null;
  onVoiceProfileChange: (profileId: string | null) => void;
}

export default function MainPanel({
  onGenerated: _onGenerated,
  onError,
  settings,
  voiceboxProfiles,
  activeVoiceProfileId,
  onVoiceProfileChange,
}: Props) {
  const { editorText, setEditorText } = usePlayback();
  const { trackEnqueued, activeJobs, jobs, latestId } = useJobs();
  const progress = useLatestJobProgress();
  const lastReportedJobErrorRef = useRef<string | null>(null);
  const [enqueuing, setEnqueuing] = useState(false);
  const [blockDoc, setBlockDoc] = useState<BlockDoc>(EMPTY_DOC);
  const initialPlainSyncedRef = useRef(false);
  const { openSettingsTab, goToView } = useAppView();

  const [textFilters, setTextFilters] = useState<TextFiltersSettings>(defaultTextFiltersSettings);
  const [filterSession] = useState<TextFiltersSession>(() => loadTextFiltersSession());
  const [appSettingsSnapshot, setAppSettingsSnapshot] = useState<Awaited<
    ReturnType<typeof getAppSettings>
  > | null>(null);
  const [toast, setLocalToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setLocalToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const activePreset = useMemo(() => resolveActivePreset(textFilters), [textFilters]);

  const sourceText = useMemo(
    () => blockDocToFilteredBase(blockDoc, activePreset, filterSession.builtinOverrides),
    [blockDoc, activePreset, filterSession.builtinOverrides],
  );

  const originalForPreview = useMemo(() => blockDocToSourceText(blockDoc), [blockDoc]);

  const filterResult = useMemo(
    () => applyTextFilters(sourceText, activePreset, filterSession.builtinOverrides),
    [sourceText, activePreset, filterSession.builtinOverrides],
  );

  const persistTextFilters = useCallback(
    async (next: TextFiltersSettings) => {
      setTextFilters(next);
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
    [appSettingsSnapshot, onError],
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

  const resetEditor = useCallback(() => {
    setEditorText("");
    setBlockDoc(EMPTY_DOC);
  }, [setEditorText]);

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
    if (editorText.trim() && blockDoc.blocks.every((b) => !b.text.trim())) {
      setBlockDoc(plainTextToBlockDoc(editorText));
    }
    initialPlainSyncedRef.current = true;
  }, [editorText, blockDoc.blocks]);

  useEffect(() => {
    const onLoad = (ev: Event) => {
      const text = (ev as CustomEvent<EditorTextLoadDetail>).detail?.text ?? "";
      setEditorText(text);
      setBlockDoc(plainTextToBlockDoc(text));
    };
    window.addEventListener(EDITOR_TEXT_LOAD_EVENT, onLoad);
    return () => window.removeEventListener(EDITOR_TEXT_LOAD_EVENT, onLoad);
  }, [setEditorText]);

  const enqueueGeneration = async (
    tts: SettingsState,
    formatOverride: string | null,
    presetForFilter: TextFilterPreset,
    voiceProfileId?: string | null,
  ) => {
    const filtered = applyTextFilters(
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
        minimax_speed: tts.provider === "minimax" ? tts.minimaxSpeed : null,
        minimax_vol: tts.provider === "minimax" ? tts.minimaxVol : null,
        minimax_pitch: tts.provider === "minimax" ? tts.minimaxPitch : null,
      });
      trackEnqueued(g);
      void touchVoiceProfilePreviews(tts, filtered, voiceProfileId).catch(() => undefined);
      resetEditor();
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
  const queuedCount = activeJobs.filter((j) => j.status === "queued").length;
  const runningCount = activeJobs.filter((j) => j.status === "running").length;
  const activeBadge =
    activeJobs.length > 0 ? `${runningCount} w toku · ${queuedCount} w kolejce` : null;

  const canGenerate =
    blockDoc.blocks.some((b) => b.text.trim().length > 0) && filterResult.output.trim().length > 0;

  const hasEditorContent = blockDoc.blocks.some((b) => b.text.trim().length > 0);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 border-b border-border bg-panel">
        <div className="min-w-0">
          <div className="text-lg font-semibold">TTS Hub</div>
          <div className="text-xs text-muted">
            Google Gemini · Voice Box · Minimax Portal · localhost:8765
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {activeBadge && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-panel2 border border-border text-muted">
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
          <button
            type="button"
            className="btn"
            onClick={resetEditor}
            disabled={!hasEditorContent}
            title="Wyczyść edytor i zacznij od nowa"
          >
            Nowa generacja
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 gap-2">
        <div className="shrink-0">
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
            onVoiceProfileChange={onVoiceProfileChange}
            onSaveModeToggle={() => void toggleSaveMode()}
          />
        </div>
        <div className="shrink-0">
          <SynthTextPreview
            original={originalForPreview}
            filtered={filterResult.output}
            warnings={filterResult.warnings}
          />
        </div>
        <div
          className={`grid shrink-0 transition-[grid-template-rows,opacity,margin-bottom] duration-300 ease-out ${
            showProgress ? "grid-rows-[1fr] opacity-100 mb-1" : "grid-rows-[0fr] opacity-0 mb-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <GenerationProgressBar progress={progress} />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <BlockEditorPane
            blockDoc={blockDoc}
            onBlockDocChange={setBlockDoc}
            onEnterWithCtrl={() => void onGenerate()}
            footerAction={
              <button
                type="button"
                className="btn-primary"
                onClick={() => void onGenerate()}
                disabled={enqueuing || !canGenerate}
                title="Dodaje do kolejki (Ctrl+Enter)"
              >
                {enqueuing ? "Dodawanie..." : "Generuj"}
              </button>
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
