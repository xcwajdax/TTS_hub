import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MainPanel from "./components/MainPanel";
import PlaybackBar from "./components/PlaybackBar";
import HistoryBrowseView from "./components/HistoryBrowseView";
import HistoryQuickPanel from "./components/HistoryQuickPanel";
import { useGenerationsHistory } from "./hooks/useGenerationsHistory";
import SettingsSidebar from "./components/SettingsSidebar";
import { useTtsSettings } from "./hooks/useTtsSettings";
import RecoveryModal from "./components/RecoveryModal";
import GlobalSearchModal from "./components/globalSearch/GlobalSearchModal";
import { GLOBAL_SEARCH_OPEN_EVENT } from "./lib/globalSearch/events";
import { PlaybackProvider, usePlayback } from "./context/PlaybackContext";
import { JobsProvider, useJobs } from "./context/JobsContext";
import type { Generation } from "./types";
import {
  getAppSettings,
  openQuickSetupWindow,
} from "./api/tauri";
import OnboardingOrchestrator from "./components/tutorial/OnboardingOrchestrator";
import { syncSaveFormatFromSettings } from "./audioFormats";
import { useAppMenu } from "./hooks/useAppMenu";
import { useBroadcastPlaybackViz } from "./hooks/useBroadcastPlaybackViz";
import { useCursorIntegration } from "./hooks/useCursorIntegration";
import { usePlaybackToastBridge } from "./hooks/usePlaybackToastBridge";
import AppStatusBar from "./components/AppStatusBar";
import BrowserOnlyBanner from "./components/BrowserOnlyBanner";
import MockUiBootstrap from "./components/MockUiBootstrap";
import TitleBar from "./components/TitleBar";
import AppViewTabs, { type AppView } from "./components/AppViewTabs";
import type { HistoryScopeTab } from "./lib/historyToolbar";
import ExtensionsHub from "./plugins/ExtensionsHub";
import SoundboardView from "./plugins/soundboard/SoundboardView";
import { BUILTIN_PLUGIN_STUBS } from "./plugins/registry";
import { getPlugins } from "./api/tauri";
import { PLUGINS_CHANGED } from "./plugins/events";
import type { PluginManifest } from "./plugins/types";
import { isCursorPlaybackSource } from "./lib/cursorSource";
import { isTauriApp } from "./lib/tauriEnv";
import { isMockUiMode, MOCK_PLUGINS } from "./lib/mockUi";
import { usePlaybackQueue } from "./hooks/usePlaybackQueue";
import { TimelineViewProvider } from "./context/TimelineViewContext";
import { SkinProvider } from "./skins/SkinProvider";
import { SkinTransitionProvider } from "./skins/transition/SkinTransitionProvider";
import RoleplayView from "./roleplay/RoleplayView";
import ChatView from "./chat/ChatView";
import SettingsView from "./components/settings/SettingsView";
import MinimaxVoicesView from "./components/MinimaxVoicesView";
import VoiceboxView from "./components/VoiceboxView";
import VoiceProfilesView from "./components/voiceProfiles/VoiceProfilesView";
import { DEFAULT_MINIMAX_VOICES_SECTION, type MinimaxVoicesSection } from "./components/minimaxVoicesSections";
import {
  DEFAULT_VOICEBOX_SECTION,
  type VoiceboxSection,
} from "./components/voicebox/voiceboxSections";
import { AppViewContext, type AppViewNav } from "./context/AppViewContext";
import type { SettingsViewTab } from "./components/settings/settingsTabs";
import type { TtsProviderId, TtsVoiceProfile } from "./appSettings";
import { mergeSessionAndArchiveHistory, isGenerationPlayable } from "./lib/generationPlayback";
import { getPrivacyModeSnapshot } from "./lib/privacyMode";
import { voiceProfileToSettingsState } from "./lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "./lib/voiceProfilesEvents";

interface AppInnerProps {
  appView: AppView;
  activePluginId: string | null;
  historyInitialScope?: HistoryScopeTab;
  onHistoryInitialScopeConsumed: () => void;
  onFocusSoundboard: () => void;
  onOpenPlugin: (id: string) => void;
  onBackToHub: () => void;
  onNavigateExtensions: () => void;
  setAppViewState: (v: AppView) => void;
  setSettingsTabState: (tab: SettingsViewTab) => void;
  settingsTab: SettingsViewTab;
  onStartProductTour: () => void;
  onGoToHistoryScope: (scope: HistoryScopeTab) => void;
}

function AppInner({
  appView,
  activePluginId,
  historyInitialScope,
  onHistoryInitialScopeConsumed,
  onFocusSoundboard,
  onOpenPlugin,
  onBackToHub,
  setAppViewState,
  setSettingsTabState,
  settingsTab,
  onStartProductTour,
  onGoToHistoryScope,
}: AppInnerProps) {
  const { current, playing, playNonce, select, audioRef, setEditorText, playClip } = usePlayback();
  const { onDone } = useJobs();
  useBroadcastPlaybackViz();
  const [showRecovery, setShowRecovery] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    session,
    archive,
    cursorFeed,
    botsFeed,
    folders,
    tags,
    interrupted,
    currentSessionId,
    refresh,
    refreshInterrupted,
  } = useGenerationsHistory(setError);
  const [toast, setToast] = useState<string | null>(null);
  usePlaybackToastBridge({
    onHistoryChanged: refresh,
    onReminder: (title) => {
      setToast(`Przypomnienie: ${title}`);
      window.setTimeout(() => setToast(null), 3500);
    },
  });
  const [plugins, setPlugins] = useState<PluginManifest[]>(BUILTIN_PLUGIN_STUBS);
  const [enabledProviders, setEnabledProviders] = useState<TtsProviderId[] | undefined>();
  const { cfg, lastCursor } = useCursorIntegration();
  const { playOrEnqueue, clearQueue } = usePlaybackQueue(select, audioRef, playing);
  const lastCursorGenRef = useRef<Generation | null>(null);
  const lastHandledCursorIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isMockUiMode()) {
      setEnabledProviders(["google", "minimax", "voicebox"]);
      return;
    }
    if (!isTauriApp()) return;
    let mounted = true;
    void getAppSettings().then((view) => {
      if (!mounted) return;
      setEnabledProviders(view.enabled_providers);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleHistoryChanged = useCallback(() => {
    void refresh();
    void refreshInterrupted();
  }, [refresh, refreshInterrupted]);

  const quickHistoryItems = useMemo(
    () => mergeSessionAndArchiveHistory(session, archive),
    [session, archive],
  );

  const handleSelectGeneration = useCallback(
    (g: Generation) => {
      clearQueue();
      const fresh = quickHistoryItems.find((x) => x.id === g.id) ?? g;
      if (!isMockUiMode() && !isGenerationPlayable(fresh)) {
        setError("To nagranie nie jest jeszcze gotowe lub plik audio nie istnieje.");
        return;
      }
      setAppViewState("tts");
      select(fresh, { loadEditorText: true, autoPlay: false });
    },
    [clearQueue, quickHistoryItems, select, setAppViewState],
  );

  const handlePlayGeneration = useCallback(
    (g: Generation) => {
      clearQueue();
      const fresh = quickHistoryItems.find((x) => x.id === g.id) ?? g;
      if (!isMockUiMode() && !isGenerationPlayable(fresh)) {
        setError("To nagranie nie jest jeszcze gotowe lub plik audio nie istnieje.");
        return;
      }
      setAppViewState("tts");
      select(fresh, { loadEditorText: true, autoPlay: true });
    },
    [clearQueue, quickHistoryItems, select, setAppViewState],
  );

  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, open);
    return () => window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setSearchOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    refresh();
    void syncSaveFormatFromSettings();
    void refreshInterrupted().then((list) => {
      if (list.length > 0) setShowRecovery(true);
    });
    if (isMockUiMode()) {
      setPlugins(MOCK_PLUGINS);
    } else if (isTauriApp()) {
      void getPlugins()
        .then(setPlugins)
        .catch(() => setPlugins(BUILTIN_PLUGIN_STUBS));
    }
  }, [refresh, refreshInterrupted]);

  useEffect(() => {
    if (!isTauriApp()) return;
    const sync = () => {
      void getPlugins()
        .then(setPlugins)
        .catch(() => {});
    };
    window.addEventListener(PLUGINS_CHANGED, sync);
    return () => window.removeEventListener(PLUGINS_CHANGED, sync);
  }, []);

  useEffect(() => {
    return onDone((g) => {
      const incognito = getPrivacyModeSnapshot() === "incognito";
      if (!incognito) {
        void refresh();
      }
      if (!isGenerationPlayable(g)) return;
      // Cursor / skill / quick_hotkey autoplay: generation:ready → dedicated listeners.
      if (isCursorPlaybackSource(g.source) && cfg.autoplay) return;
      if (g.source === "quick_hotkey") return;
      if (incognito) {
        select(g, { loadEditorText: true, autoPlay: true });
        return;
      }
      playOrEnqueue(g, { loadEditorText: false });
    });
  }, [onDone, refresh, playOrEnqueue, cfg.autoplay, select]);

  useEffect(() => {
    if (!lastCursor) return;
    if (lastHandledCursorIdRef.current === lastCursor.id) return;
    lastHandledCursorIdRef.current = lastCursor.id;
    lastCursorGenRef.current = lastCursor;
    void refresh();
    if (cfg.autoplay) {
      const { queued, queueLength } = playOrEnqueue(lastCursor, { loadEditorText: false });
      setToast(
        queued
          ? `Cursor (kolejka ${queueLength}): ${lastCursor.title ?? "podsumowanie"}`
          : `Cursor: ${lastCursor.title ?? "podsumowanie"}`,
      );
    } else {
      setToast(`Cursor: ${lastCursor.title ?? "podsumowanie"}`);
    }
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [lastCursor, cfg.autoplay, refresh, playOrEnqueue]);

  // Global shortcut Ctrl+Shift+P: replay last cursor summary.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        const g = lastCursorGenRef.current;
        if (g) {
          e.preventDefault();
          clearQueue();
          select(g, { loadEditorText: false });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select, clearQueue]);

  const onGenerated = (g: Generation) => {
    if (getPrivacyModeSnapshot() === "incognito") {
      return;
    }
    if (isGenerationPlayable(g)) {
      playOrEnqueue(g, { loadEditorText: false });
    }
    refresh();
  };

  const handleRecoveryClose = useCallback(() => {
    setShowRecovery(false);
    void refreshInterrupted();
  }, [refreshInterrupted]);

  useEffect(() => {
    if (!isTauriApp()) return;
    let unlistenEditor: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenReady: (() => void) | undefined;

    void listen<{ text: string; presetId: string; generationId: string }>(
      "quick-hotkey:load-editor",
      (ev) => {
        setEditorText(ev.payload.text);
        setToast("Szybki TTS: tekst w edytorze");
        window.setTimeout(() => setToast(null), 3500);
      },
    ).then((fn) => {
      unlistenEditor = fn;
    });

    void listen<{ message: string; presetId: string }>("quick-hotkey:error", (ev) => {
      setError(ev.payload.message);
    }).then((fn) => {
      unlistenError = fn;
    });

    void listen<Generation>("generation:ready", (ev) => {
      if (ev.payload?.source === "quick_hotkey") {
        playOrEnqueue(ev.payload, { loadEditorText: false });
      }
    }).then((fn) => {
      unlistenReady = fn;
    });

    let unlistenSb: (() => void) | undefined;
    let unlistenSbErr: (() => void) | undefined;

    void listen<{ slotIndex: number; path: string; label: string }>("soundboard:play", (ev) => {
      playClip({ path: ev.payload.path, label: ev.payload.label });
      setToast(`Soundboard: ${ev.payload.label}`);
      window.setTimeout(() => setToast(null), 2500);
    }).then((fn) => {
      unlistenSb = fn;
    });

    void listen<{ message: string; slotIndex: number }>("soundboard:error", (ev) => {
      setError(ev.payload.message);
    }).then((fn) => {
      unlistenSbErr = fn;
    });

    return () => {
      unlistenEditor?.();
      unlistenError?.();
      unlistenReady?.();
      unlistenSb?.();
      unlistenSbErr?.();
    };
  }, [setEditorText, playOrEnqueue, playClip]);

  const ttsSettings = useTtsSettings(setError);
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string | null>(null);
  const [minimaxVoicesSection, setMinimaxVoicesSection] = useState<MinimaxVoicesSection>(
    DEFAULT_MINIMAX_VOICES_SECTION,
  );
  const [voiceboxSection, setVoiceboxSection] = useState<VoiceboxSection>(DEFAULT_VOICEBOX_SECTION);

  const applyVoiceProfile = useCallback(
    (profile: TtsVoiceProfile) => {
      setActiveVoiceProfileId(profile.id);
      ttsSettings.setSettings(voiceProfileToSettingsState(profile));
    },
    [ttsSettings.setSettings],
  );

  const handleVoiceProfileIdChange = useCallback(
    async (profileId: string | null) => {
      setActiveVoiceProfileId(profileId);
      if (!profileId) return;
      try {
        const view = await getAppSettings();
        const profile = view.voice_profiles?.find((p) => p.id === profileId);
        if (profile) applyVoiceProfile(profile);
      } catch (e) {
        setError(String(e));
      }
    },
    [applyVoiceProfile],
  );

  const handleVoiceProfileDeleted = useCallback((profileId: string) => {
    setActiveVoiceProfileId((current) => (current === profileId ? null : current));
    window.dispatchEvent(
      new CustomEvent("tts-hub:voice-profile-deleted-tab", { detail: { profileId } }),
    );
  }, []);

  const nav: AppViewNav = useMemo(
    () => ({
      goToView: (v) => setAppViewState(v),
      openSettingsTab: (tab) => {
        setSettingsTabState(tab);
        setAppViewState("settings");
      },
      openMinimaxVoices: (section = DEFAULT_MINIMAX_VOICES_SECTION) => {
        if (String(section) === "profile") {
          setAppViewState("voice_profiles");
          return;
        }
        setMinimaxVoicesSection(section);
        setAppViewState("minimax_voices");
      },
      openVoiceProfiles: () => {
        setAppViewState("voice_profiles");
      },
      openVoiceboxView: (section = DEFAULT_VOICEBOX_SECTION) => {
        if (String(section) === "tts_preset") {
          setAppViewState("voice_profiles");
          return;
        }
        setVoiceboxSection(section);
        setAppViewState("voicebox");
      },
      onBackToTts: () => setAppViewState("tts"),
    }),
    [setAppViewState, setSettingsTabState],
  );

  useAppMenu({
    current,
    setEditorText,
    onRefresh: refresh,
    onError: setError,
    onOpenSettings: () => nav.openSettingsTab("overview"),
    onOpenMinimaxVoices: () => nav.openMinimaxVoices(),
    onOpenQuickHotkeys: () => nav.openSettingsTab("quick_hotkeys"),
    onOpenQuickSetup: () => {
      void openQuickSetupWindow().catch((e) => setError(String(e)));
    },
    onStartProductTour,
    onOpenSoundboard: onFocusSoundboard,
  });

  if (appView === "settings") {
    return (
      <AppViewContext.Provider value={nav}>
        <SettingsView
          onError={setError}
          onSuccess={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 2500);
          }}
          onOrganizationChanged={() => void refresh()}
          onLocalDataCleared={() => void refresh()}
          initialTab={settingsTab}
          activeVoiceProfileId={activeVoiceProfileId}
          onSelectVoiceProfile={applyVoiceProfile}
          onVoiceProfileDeleted={handleVoiceProfileDeleted}
        />
        {error && (
          <div
            className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setError(null)}
            title="Kliknij aby zamknac"
          >
            {error}
          </div>
        )}
        {toast && (
          <div
            className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setToast(null)}
            title="Kliknij aby zamknac"
          >
            {toast}
          </div>
        )}
      </AppViewContext.Provider>
    );
  }

  if (appView === "voice_profiles") {
    return (
      <AppViewContext.Provider value={nav}>
        <VoiceProfilesView
          settings={ttsSettings.settings}
          voices={ttsSettings.voices}
          voiceboxProfiles={ttsSettings.voiceboxProfiles}
          voiceboxModels={ttsSettings.voiceboxModels}
          voiceboxHealth={ttsSettings.voiceboxStatus}
          enabledProviders={enabledProviders}
          activeVoiceProfileId={activeVoiceProfileId}
          onSettingsChange={ttsSettings.setSettings}
          onSelectVoiceProfile={applyVoiceProfile}
          onError={setError}
          onSuccess={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 2500);
          }}
        />
        {error && (
          <div
            className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setError(null)}
            title="Kliknij aby zamknac"
          >
            {error}
          </div>
        )}
        {toast && (
          <div
            className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setToast(null)}
            title="Kliknij aby zamknac"
          >
            {toast}
          </div>
        )}
      </AppViewContext.Provider>
    );
  }

  if (appView === "minimax_voices") {
    return (
      <AppViewContext.Provider value={nav}>
        <MinimaxVoicesView
          initialSection={minimaxVoicesSection}
          enabledProviders={enabledProviders}
          onError={setError}
          onSuccess={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 2500);
          }}
          onSettingsChanged={() => void refresh()}
        />
        {error && (
          <div
            className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setError(null)}
            title="Kliknij aby zamknac"
          >
            {error}
          </div>
        )}
        {toast && (
          <div
            className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setToast(null)}
            title="Kliknij aby zamknac"
          >
            {toast}
          </div>
        )}
      </AppViewContext.Provider>
    );
  }

  if (appView === "voicebox") {
    return (
      <AppViewContext.Provider value={nav}>
        <VoiceboxView
          initialSection={voiceboxSection}
          settings={ttsSettings.settings}
          voiceboxProfiles={ttsSettings.voiceboxProfiles}
          voiceboxModels={ttsSettings.voiceboxModels}
          voiceboxHealth={ttsSettings.voiceboxStatus}
          enabledProviders={enabledProviders}
          onSettingsChange={ttsSettings.setSettings}
          onRefreshVoicebox={ttsSettings.refreshVoicebox}
          onError={setError}
          onSuccess={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 2500);
          }}
        />
        {error && (
          <div
            className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setError(null)}
            title="Kliknij aby zamknac"
          >
            {error}
          </div>
        )}
        {toast && (
          <div
            className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setToast(null)}
            title="Kliknij aby zamknac"
          >
            {toast}
          </div>
        )}
      </AppViewContext.Provider>
    );
  }

  if (appView === "history") {
    return (
      <AppViewContext.Provider value={nav}>
        <div className="h-full w-full flex flex-col min-h-0 relative">
          <HistoryBrowseView
            session={session}
            archive={archive}
            cursorFeed={cursorFeed}
            botsFeed={botsFeed}
            folders={folders}
            tags={tags}
            currentSessionId={currentSessionId}
            currentId={current?.id ?? null}
            initialScope={historyInitialScope}
            onInitialScopeConsumed={onHistoryInitialScopeConsumed}
            onSoundboardToast={(msg) => {
              setToast(msg);
              window.setTimeout(() => setToast(null), 2500);
            }}
            onSelect={handleSelectGeneration}
            onPlay={handlePlayGeneration}
            onChanged={handleHistoryChanged}
            onError={setError}
            onOpenOrganizationSettings={() => nav.openSettingsTab("organization")}
          />
          {error && (
            <div
              className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setError(null)}
            >
              {error}
            </div>
          )}
          {toast && (
            <div
              className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setToast(null)}
            >
              {toast}
            </div>
          )}
        </div>
      </AppViewContext.Provider>
    );
  }

  if (appView === "roleplay") {
    return (
      <AppViewContext.Provider value={nav}>
        <div className="h-full w-full flex flex-col min-h-0 relative">
          <RoleplayView onError={setError} onToast={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 3500);
          }} />
          {error && (
            <div
              className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setError(null)}
            >
              {error}
            </div>
          )}
          {toast && (
            <div
              className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setToast(null)}
            >
              {toast}
            </div>
          )}
        </div>
      </AppViewContext.Provider>
    );
  }

  if (appView === "chat") {
    return (
      <AppViewContext.Provider value={nav}>
        <div className="h-full w-full flex flex-col min-h-0 relative">
          <ChatView
            onError={setError}
            onToast={(msg) => {
              setToast(msg);
              window.setTimeout(() => setToast(null), 2500);
            }}
          />
          {error && (
            <div
              className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setError(null)}
            >
              {error}
            </div>
          )}
          {toast && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-panel2 border border-border text-heading px-3 py-2 rounded shadow-lg text-sm">
              {toast}
            </div>
          )}
        </div>
      </AppViewContext.Provider>
    );
  }

  if (appView === "extensions") {
    return (
      <AppViewContext.Provider value={nav}>
        <div className="h-full w-full flex flex-col min-h-0 relative">
          {activePluginId === "soundboard" ? (
            <SoundboardView
              onBack={onBackToHub}
              onError={setError}
              onToast={(msg) => {
                setToast(msg);
                window.setTimeout(() => setToast(null), 2500);
              }}
            />
          ) : (
            <ExtensionsHub
              plugins={plugins}
              onPluginsChange={setPlugins}
              onOpenPlugin={onOpenPlugin}
              onError={setError}
              onToast={(msg) => {
                setToast(msg);
                window.setTimeout(() => setToast(null), 3500);
              }}
            />
          )}
          {error && (
            <div
              className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setError(null)}
              title="Kliknij aby zamknac"
            >
              {error}
            </div>
          )}
          {toast && (
            <div
              className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
              onClick={() => setToast(null)}
              title="Kliknij aby zamknac"
            >
              {toast}
            </div>
          )}
        </div>
      </AppViewContext.Provider>
    );
  }

  return (
    <AppViewContext.Provider value={nav}>
      <div className="h-full w-full grid relative" style={{ gridTemplateColumns: "1fr 3fr 1fr" }}>
        <SettingsSidebar
          onError={setError}
          recentGenerations={session}
          onProfileEdited={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 3500);
          }}
          onProfileDeleted={handleVoiceProfileDeleted}
          activeVoiceProfileId={activeVoiceProfileId}
          onSelectVoiceProfile={applyVoiceProfile}
        />
        <div
          className="grid min-h-0 min-w-0 overflow-hidden h-full border-x border-border"
          style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}
        >
          <MainPanel
            onGenerated={onGenerated}
            onError={setError}
            settings={ttsSettings.settings}
            voiceboxProfiles={ttsSettings.voiceboxProfiles}
            activeVoiceProfileId={activeVoiceProfileId}
            onVoiceProfileChange={(id) => void handleVoiceProfileIdChange(id)}
          />
          <PlaybackBar
            current={current}
            playNonce={playNonce}
            sessionIndex={current ? session.findIndex((g) => g.id === current.id) : -1}
            sessionTotal={session.length}
            activeVoiceProfileId={activeVoiceProfileId}
            ttsSettings={ttsSettings.settings}
            folders={folders}
            tags={tags}
            onHistoryChanged={handleHistoryChanged}
            onError={setError}
            onToast={(msg) => {
              setToast(msg);
              window.setTimeout(() => setToast(null), 3500);
            }}
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <HistoryQuickPanel
            items={quickHistoryItems}
            folders={folders}
            interrupted={interrupted}
            currentId={current?.id ?? null}
            onSelect={handleSelectGeneration}
            onPlay={handlePlayGeneration}
            onChanged={handleHistoryChanged}
            onError={setError}
            onToast={(msg) => {
              setToast(msg);
              window.setTimeout(() => setToast(null), 3500);
            }}
          />
        </div>
        <RecoveryModal
          open={showRecovery}
          items={interrupted}
          onClose={handleRecoveryClose}
          onChanged={() => {
            void refreshInterrupted();
          }}
          onError={setError}
        />
        <GlobalSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          session={session}
          archive={archive}
          cursorFeed={cursorFeed}
          botsFeed={botsFeed}
          onSelectHistory={(g, play) => {
            if (play) handlePlayGeneration(g);
            else handleSelectGeneration(g);
          }}
          onGoToView={setAppViewState}
          onGoToHistoryScope={onGoToHistoryScope}
          onError={setError}
        />
        {error && (
          <div
            className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setError(null)}
            title="Kliknij aby zamknac"
          >
            {error}
          </div>
        )}
        {toast && (
          <div
            className="fixed bottom-4 left-4 max-w-md bg-emerald-900/80 border border-emerald-700 text-emerald-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer"
            onClick={() => setToast(null)}
            title="Kliknij aby zamknac"
          >
            {toast}
          </div>
        )}
      </div>
    </AppViewContext.Provider>
  );
}

export default function App() {
  const inTauri = isTauriApp();
  const [appView, setAppView] = useState<AppView>("tts");
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const [historyInitialScope, setHistoryInitialScope] = useState<HistoryScopeTab | undefined>(
    undefined,
  );
  const [settingsTab, setSettingsTab] = useState<SettingsViewTab>("overview");
  const [onboardingRestart, setOnboardingRestart] = useState(0);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [enabledProviders, setEnabledProviders] = useState<TtsProviderId[] | undefined>();

  useEffect(() => {
    if (isMockUiMode()) {
      setEnabledProviders(["google", "minimax", "voicebox"]);
      return;
    }
    if (!inTauri) return;
    let mounted = true;
    void getAppSettings().then((view) => {
      if (!mounted) return;
      setEnabledProviders(view.enabled_providers);
    });
    return () => {
      mounted = false;
    };
  }, [inTauri]);

  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    void listen<{ name?: string }>("voice-pack:imported", () => {
      window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [inTauri]);

  const showMinimaxVoices = !enabledProviders || enabledProviders.includes("minimax");
  const showVoicebox = !enabledProviders || enabledProviders.includes("voicebox");

  return (
    <SkinProvider>
      <SkinTransitionProvider>
      <TimelineViewProvider>
        <PlaybackProvider>
          <MockUiBootstrap />
          <div className="h-full w-full flex flex-col min-h-0">
            {inTauri && <TitleBar />}
            {!inTauri && <BrowserOnlyBanner />}
            <AppViewTabs
              view={appView}
              onViewChange={(v) => {
                if (v === "settings") setSettingsTab("overview");
                setAppView(v);
              }}
              showMinimaxVoices={showMinimaxVoices}
              showVoicebox={showVoicebox}
            />
            <JobsProvider>
              <div className="flex-1 min-h-0 min-w-0">
                <AppInner
                  appView={appView}
                  activePluginId={activePluginId}
                  historyInitialScope={historyInitialScope}
                  onHistoryInitialScopeConsumed={() => setHistoryInitialScope(undefined)}
                  onFocusSoundboard={() => {
                    setAppView("history");
                    setHistoryInitialScope("soundboard");
                  }}
                  onOpenPlugin={(id) => {
                    if (id === "soundboard") {
                      setAppView("history");
                      setHistoryInitialScope("soundboard");
                      setActivePluginId(null);
                      return;
                    }
                    setAppView("extensions");
                    setActivePluginId(id);
                  }}
                  onBackToHub={() => setActivePluginId(null)}
                  onNavigateExtensions={() => setAppView("extensions")}
                  setAppViewState={setAppView}
                  setSettingsTabState={setSettingsTab}
                  settingsTab={settingsTab}
                  onStartProductTour={() => setOnboardingRestart((n) => n + 1)}
                  onGoToHistoryScope={(scope) => {
                    setAppView("history");
                    setHistoryInitialScope(scope);
                  }}
                />
              </div>
              <OnboardingOrchestrator
                restartToken={onboardingRestart}
                goToView={setAppView}
                openSettingsTab={(tab) => {
                  setSettingsTab(tab);
                  setAppView("settings");
                }}
                onError={setOnboardingError}
              />
              {onboardingError && (
                <div
                  className="fixed bottom-4 right-4 max-w-md bg-red-900/80 border border-red-700 text-red-100 px-3 py-2 rounded shadow-lg text-sm cursor-pointer z-[80]"
                  onClick={() => setOnboardingError(null)}
                  title="Kliknij aby zamknac"
                >
                  {onboardingError}
                </div>
              )}
              <AppStatusBar
                onOpenAppearance={() => {
                  setSettingsTab("appearance");
                  setAppView("settings");
                }}
              />
            </JobsProvider>
          </div>
        </PlaybackProvider>
      </TimelineViewProvider>
      </SkinTransitionProvider>
    </SkinProvider>
  );
}
