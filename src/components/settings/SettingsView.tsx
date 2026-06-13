import { useEffect, useState } from "react";
import { getTokenUsage } from "../../api/tauri";
import { syncSaveFormatFromSettings } from "../../audioFormats";
import { normalizeTimelineViewMode } from "../../lib/timelineView";
import { useTimelineView } from "../../context/TimelineViewContext";
import SettingsRail from "./SettingsRail";
import type { SettingsTabId } from "./settingsTabs";
import { useSettingsView } from "./useSettingsView";
import type { TtsVoiceProfile } from "../../appSettings";
import GeneralPage from "./pages/GeneralPage";
import ProvidersPage from "./pages/ProvidersPage";
import VoiceProfilesPage from "./pages/VoiceProfilesPage";
import AudioOutputPage from "./pages/AudioOutputPage";
import UsagePage from "./pages/UsagePage";
import FiltersPage from "./pages/FiltersPage";
import QuickHotkeysPage from "./pages/QuickHotkeysPage";
import CursorPage from "./pages/CursorPage";
import AppearancePage from "./pages/AppearancePage";
import AvatarsPage from "./pages/AvatarsPage";
import OrganizationPage from "./pages/OrganizationPage";
import MemoryPage from "./pages/MemoryPage";
import AboutPage from "./pages/AboutPage";
import { useAppView } from "../../context/AppViewContext";

interface Props {
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onOrganizationChanged?: () => void;
  onLocalDataCleared?: () => void;
  initialTab?: SettingsTabId;
  activeVoiceProfileId?: string | null;
  onSelectVoiceProfile?: (profile: TtsVoiceProfile) => void;
  onVoiceProfileDeleted?: (profileId: string) => void;
}

export default function SettingsView({
  onError,
  onSuccess,
  onOrganizationChanged,
  onLocalDataCleared,
  initialTab,
  activeVoiceProfileId = null,
  onSelectVoiceProfile,
  onVoiceProfileDeleted,
}: Props) {
  const settings = useSettingsView({ onError, onSuccess });
  const { onBackToTts } = useAppView();
  const [tab, setTab] = useState<SettingsTabId>(initialTab ?? "general");
  const { setMode: syncTimelineView } = useTimelineView();

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!settings.view) return;
    void syncTimelineView(normalizeTimelineViewMode(settings.view.timeline_view), {
      persist: false,
    });
  }, [settings.view, syncTimelineView]);

  if (!settings.view) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted text-sm">
        Ładowanie ustawień…
      </div>
    );
  }

  const refreshUsage = () => {
    void getTokenUsage().catch(() => undefined);
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-panel">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-panel2/40">
        <div className="flex flex-col">
          <h1 className="text-base font-semibold">Ustawienia</h1>
          <p className="text-[11px] text-muted">
            Zmiany zapisują się automatycznie po kilku chwilach.
          </p>
        </div>
        <button type="button" className="btn text-xs" onClick={onBackToTts}>
          ← Wróć do TTS
        </button>
      </header>

      <div className="flex-1 min-h-0 flex">
        <SettingsRail active={tab} onSelect={setTab} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-5">
            {tab === "general" && (
              <GeneralPage
                view={settings.view}
                update={settings.update}
                onError={onError}
                onSuccess={onSuccess}
              />
            )}
            {tab === "providers" && (
              <ProvidersPage
                view={settings.view}
                update={settings.update}
                onError={onError}
              />
            )}
            {tab === "voice_profiles" && onSelectVoiceProfile ? (
              <VoiceProfilesPage
                activeVoiceProfileId={activeVoiceProfileId}
                onSelectVoiceProfile={onSelectVoiceProfile}
                onError={onError}
                onSuccess={onSuccess}
                onProfileDeleted={onVoiceProfileDeleted}
              />
            ) : null}
            {tab === "audio_output" && <AudioOutputPage />}
            {tab === "usage" && <UsagePage />}
            {tab === "filters" && (
              <FiltersPage
                view={settings.view}
                update={settings.update}
                onError={onError}
              />
            )}
            {tab === "quick_hotkeys" && (
              <QuickHotkeysPage
                view={settings.view}
                update={settings.update}
                onError={onError}
                onSuccess={onSuccess}
              />
            )}
            {tab === "cursor" && (
              <CursorPage
                view={settings.view}
                update={settings.update}
                onError={onError}
              />
            )}
            {tab === "appearance" && (
              <AppearancePage
                view={settings.view}
                update={settings.update}
                onError={onError}
              />
            )}
            {tab === "avatars" && <AvatarsPage onError={onError} />}
            {tab === "organization" && (
              <OrganizationPage
                onError={onError}
                onChanged={() => {
                  onOrganizationChanged?.();
                  refreshUsage();
                }}
              />
            )}
            {tab === "memory" && (
              <MemoryPage
                onError={onError}
                onSuccess={onSuccess}
                onCleared={() => {
                  onLocalDataCleared?.();
                  void syncSaveFormatFromSettings();
                  void settings.reload();
                }}
              />
            )}
            {tab === "about" && <AboutPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
