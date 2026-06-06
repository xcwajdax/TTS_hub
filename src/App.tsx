import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import MainPanel from "./components/MainPanel";
import PlaybackBar from "./components/PlaybackBar";
import HistorySidebar from "./components/HistorySidebar";
import SettingsSidebar from "./components/SettingsSidebar";
import { useTtsSettings } from "./hooks/useTtsSettings";
import RecoveryModal from "./components/RecoveryModal";
import { PlaybackProvider, usePlayback } from "./context/PlaybackContext";
import { JobsProvider, useJobs } from "./context/JobsContext";
import type { Generation } from "./types";
import {
  getAppSettings,
  getSessionId,
  listFolders,
  listTags,
  listHistory,
  listJobs,
  openQuickSetupWindow,
  setAppSettings,
} from "./api/tauri";
import type { ArchiveFolder, ArchiveTag } from "./types";
import QuickSetupPrompt from "./components/quickSetup/QuickSetupPrompt";
import { syncSaveFormatFromSettings } from "./audioFormats";
import { useAppMenu } from "./hooks/useAppMenu";
import { useBroadcastPlaybackViz } from "./hooks/useBroadcastPlaybackViz";
import { useCursorIntegration } from "./hooks/useCursorIntegration";
import { usePlaybackToastRemote } from "./hooks/usePlaybackToastRemote";
import { usePlaybackToastWindow } from "./hooks/usePlaybackToastWindow";
import BrowserOnlyBanner from "./components/BrowserOnlyBanner";
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
import { usePlaybackQueue } from "./hooks/usePlaybackQueue";
import { TimelineViewProvider } from "./context/TimelineViewContext";
import { SkinProvider } from "./skins/SkinProvider";
import RoleplayView from "./roleplay/RoleplayView";
import ChatView from "./chat/ChatView";

interface AppInnerProps {
  appView: AppView;
  activePluginId: string | null;
  historyInitialScope?: HistoryScopeTab;
  onHistoryInitialScopeConsumed: () => void;
  onFocusSoundboard: () => void;
  onOpenPlugin: (id: string) => void;
  onBackToHub: () => void;
  onNavigateExtensions: () => void;
}

function AppInner({
  appView,
  activePluginId,
  historyInitialScope,
  onHistoryInitialScopeConsumed,
  onFocusSoundboard,
  onOpenPlugin,
  onBackToHub,
}: AppInnerProps) {
  const { current, playing, playNonce, select, audioRef, setEditorText, playClip } = usePlayback();
  const { onDone } = useJobs();
  useBroadcastPlaybackViz();
  usePlaybackToastWindow();
  usePlaybackToastRemote();
  const [session, setSession] = useState<Generation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [archive, setArchive] = useState<Generation[]>([]);
  const [cursorFeed, setCursorFeed] = useState<Generation[]>([]);
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [tags, setTags] = useState<ArchiveTag[]>([]);
  const [interrupted, setInterrupted] = useState<Generation[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    | "general"
    | "usage"
    | "cursor"
    | "appearance"
    | "avatars"
    | "filters"
    | "quick_hotkeys"
    | "organization"
    | undefined
  >(undefined);
  const [showQuickSetupPrompt, setShowQuickSetupPrompt] = useState(false);
  const [plugins, setPlugins] = useState<PluginManifest[]>(BUILTIN_PLUGIN_STUBS);
  const { cfg, lastCursor } = useCursorIntegration();
  const { playOrEnqueue, clearQueue } = usePlaybackQueue(select, audioRef, playing);
  const lastCursorGenRef = useRef<Generation | null>(null);
  const lastHandledCursorIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauriApp()) return;
    try {
      const [s, a, f, t, cursor, sid] = await Promise.all([
        listHistory("session"),
        listHistory("archive"),
        listFolders(),
        listTags(),
        listHistory("cursor"),
        getSessionId(),
      ]);
      setSession(s);
      setCurrentSessionId(sid);
      setArchive(a);
      setFolders(f);
      setTags(t);
      setCursorFeed(cursor);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const refreshInterrupted = useCallback(async () => {
    if (!isTauriApp()) return [];
    try {
      const list = await listJobs("interrupted");
      setInterrupted(list);
      return list;
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  useEffect(() => {
    refresh();
    void syncSaveFormatFromSettings();
    void refreshInterrupted().then((list) => {
      if (list.length > 0) setShowRecovery(true);
    });
    if (isTauriApp()) {
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
    if (!isTauriApp()) return;
    void getAppSettings().then((view) => {
      if (!view.quick_setup_completed) setShowQuickSetupPrompt(true);
    });
  }, []);

  const dismissQuickSetupPrompt = useCallback(async () => {
    if (!isTauriApp()) {
      setShowQuickSetupPrompt(false);
      return;
    }
    try {
      const view = await getAppSettings();
      await setAppSettings({ ...view, quick_setup_completed: true });
    } catch (e) {
      setError(String(e));
    }
    setShowQuickSetupPrompt(false);
  }, []);

  // When any job finishes, refresh history and autoplay (queued if already playing).
  useEffect(() => {
    return onDone((g) => {
      void refresh();
      // Cursor / skill / quick_hotkey autoplay: generation:ready → dedicated listeners.
      if (isCursorPlaybackSource(g.source) && cfg.autoplay) return;
      if (g.source === "quick_hotkey") return;
      playOrEnqueue(g, { loadEditorText: false });
    });
  }, [onDone, refresh, playOrEnqueue, cfg.autoplay]);

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
    playOrEnqueue(g, { loadEditorText: false });
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

  useAppMenu({
    current,
    setEditorText,
    onRefresh: refresh,
    onError: setError,
    onOpenSettings: () => {
      setSettingsInitialTab(undefined);
      setSettingsOpen(true);
    },
    onOpenQuickHotkeys: () => {
      setSettingsInitialTab("quick_hotkeys");
      setSettingsOpen(true);
    },
    onOpenQuickSetup: () => {
      setShowQuickSetupPrompt(false);
      void openQuickSetupWindow().catch((e) => setError(String(e)));
    },
    onOpenSoundboard: onFocusSoundboard,
  });

  if (appView === "roleplay") {
    return (
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
    );
  }

  if (appView === "chat") {
    return (
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
    );
  }

  if (appView === "extensions") {
    return (
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
    );
  }

  return (
    <div className="h-full w-full grid relative" style={{ gridTemplateColumns: "1fr 3fr 1fr" }}>
      {showQuickSetupPrompt && (
        <QuickSetupPrompt
          onDismiss={() => void dismissQuickSetupPrompt()}
          onSaved={() => setShowQuickSetupPrompt(false)}
          onError={setError}
        />
      )}
      <SettingsSidebar
        settings={ttsSettings.settings}
        voices={ttsSettings.voices}
        voiceboxProfiles={ttsSettings.voiceboxProfiles}
        voiceboxModels={ttsSettings.voiceboxModels}
        voiceboxHealth={ttsSettings.voiceboxStatus}
        recentGenerations={session}
        onChange={ttsSettings.setSettings}
        onError={setError}
        onProfileSaved={(msg) => {
          setToast(msg);
          window.setTimeout(() => setToast(null), 3500);
        }}
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
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          settingsInitialTab={settingsInitialTab}
          onSettingsInitialTabConsumed={() => setSettingsInitialTab(undefined)}
          onSettingsSuccess={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 3500);
          }}
          onOrganizationChanged={() => void refresh()}
          onLocalDataCleared={() => void refresh()}
        />
        <PlaybackBar
          current={current}
          playNonce={playNonce}
          sessionIndex={current ? session.findIndex((g) => g.id === current.id) : -1}
          sessionTotal={session.length}
        />
      </div>
      <div className="min-w-0 overflow-hidden">
        <HistorySidebar
          session={session}
          archive={archive}
          cursorFeed={cursorFeed}
          folders={folders}
          tags={tags}
          interrupted={interrupted}
          currentSessionId={currentSessionId}
          currentId={current?.id ?? null}
          initialScope={historyInitialScope}
          onInitialScopeConsumed={onHistoryInitialScopeConsumed}
          onSoundboardToast={(msg) => {
            setToast(msg);
            window.setTimeout(() => setToast(null), 2500);
          }}
          onPlay={(g) => {
            clearQueue();
            select(g, { loadEditorText: false });
          }}
          onChanged={() => {
            void refresh();
            void refreshInterrupted();
          }}
          onError={setError}
          onOpenOrganizationSettings={() => {
            setSettingsInitialTab("organization");
            setSettingsOpen(true);
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
  );
}

export default function App() {
  const inTauri = isTauriApp();
  const [appView, setAppView] = useState<AppView>("tts");
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const [historyInitialScope, setHistoryInitialScope] = useState<HistoryScopeTab | undefined>(
    undefined,
  );

  return (
    <SkinProvider>
      <TimelineViewProvider>
        <PlaybackProvider>
          <div className="h-full w-full flex flex-col min-h-0">
            {inTauri && <TitleBar />}
            {!inTauri && <BrowserOnlyBanner />}
            <AppViewTabs view={appView} onViewChange={setAppView} />
            <div className="flex-1 min-h-0 min-w-0">
              <JobsProvider>
                <AppInner
                  appView={appView}
                  activePluginId={activePluginId}
                  historyInitialScope={historyInitialScope}
                  onHistoryInitialScopeConsumed={() => setHistoryInitialScope(undefined)}
                  onFocusSoundboard={() => {
                    setAppView("tts");
                    setHistoryInitialScope("soundboard");
                  }}
                  onOpenPlugin={(id) => {
                    if (id === "soundboard") {
                      setAppView("tts");
                      setHistoryInitialScope("soundboard");
                      setActivePluginId(null);
                      return;
                    }
                    setAppView("extensions");
                    setActivePluginId(id);
                  }}
                  onBackToHub={() => setActivePluginId(null)}
                  onNavigateExtensions={() => setAppView("extensions")}
                />
              </JobsProvider>
            </div>
          </div>
        </PlaybackProvider>
      </TimelineViewProvider>
    </SkinProvider>
  );
}
