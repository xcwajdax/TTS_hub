import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { VoiceBoxHealth, VoiceBoxProfile } from "../api/tauri";
import type { TtsProviderId, TtsVoiceProfile } from "../appSettings";
import { voiceboxModelForProfile, hubProfileMatchesVoiceboxServer } from "../lib/voiceboxProfile";
import { addVoiceboxServerProfileToHubList } from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { useAppView } from "../context/AppViewContext";
import Settings, { type SettingsState } from "./Settings";
import SaveVoiceProfileFooter from "./SaveVoiceProfileFooter";
import type { TtsModelInfo } from "../ttsModels";
import {
  DEFAULT_VOICEBOX_SECTION,
  type VoiceboxSection,
} from "./voicebox/voiceboxSections";
import VoiceboxProfilesSection from "./voicebox/VoiceboxProfilesSection";
import VoiceboxHistorySection from "./voicebox/VoiceboxHistorySection";

interface Props {
  initialSection?: VoiceboxSection;
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  onSettingsChange: (s: SettingsState) => void;
  onRefreshVoicebox: () => Promise<void>;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onProfileSaved?: (m: string) => void;
  enabledProviders?: TtsProviderId[];
}

export default function VoiceboxView({
  initialSection = DEFAULT_VOICEBOX_SECTION,
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  onSettingsChange,
  onRefreshVoicebox,
  onError,
  onSuccess,
  onProfileSaved,
  enabledProviders,
}: Props) {
  const { onBackToTts } = useAppView();
  const [section, setSection] = useState<VoiceboxSection>(initialSection);
  const [hubProfiles, setHubProfiles] = useState<TtsVoiceProfile[]>([]);

  const isEnabled = !enabledProviders || enabledProviders.includes("voicebox");

  const refreshHubProfiles = () => {
    void getAppSettings()
      .then((view) => setHubProfiles(view.voice_profiles ?? []))
      .catch(() => setHubProfiles([]));
  };

  useEffect(() => {
    refreshHubProfiles();
    window.addEventListener(VOICE_PROFILES_CHANGED, refreshHubProfiles);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refreshHubProfiles);
  }, []);

  const hubProfileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const vb of voiceboxProfiles) {
      if (hubProfiles.some((h) => hubProfileMatchesVoiceboxServer(h, vb))) {
        ids.add(vb.id);
      }
    }
    return ids;
  }, [voiceboxProfiles, hubProfiles]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (isEnabled) void onRefreshVoicebox();
  }, [isEnabled, onRefreshVoicebox]);

  const useProfileInTts = (profile: VoiceBoxProfile) => {
    const model = voiceboxModelForProfile(profile, settings.model, voiceboxModels);
    onSettingsChange({
      ...settings,
      provider: "voicebox",
      voiceboxProfileId: profile.id,
      voice: profile.name,
      language: profile.language,
      model,
    });
    onBackToTts();
    onSuccess?.(`Ustawiono profil „${profile.name}" w panelu TTS.`);
  };

  const addToProfileList = (profile: VoiceBoxProfile) => {
    void (async () => {
      try {
        const { profile: saved, created } = await addVoiceboxServerProfileToHubList(
          profile,
          voiceboxModels,
        );
        refreshHubProfiles();
        if (created) {
          onSuccess?.(`Dodano „${saved.name}" do listy profili TTS Hub.`);
        } else {
          onSuccess?.(`Profil „${saved.name}" jest już na liście profili.`);
        }
      } catch (e) {
        onError(String(e));
      }
    })();
  };

  if (!isEnabled) {
    return (
      <div className="h-full w-full flex flex-col min-h-0">
        <Header onBack={onBackToTts} health={null} />
        <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-muted">
          Provider Voice Box jest wyłączony. Włącz go w Ustawienia → Providery TTS.
        </div>
      </div>
    );
  }

  const statusLabel = voiceboxHealth
    ? `Status: ${voiceboxHealth.status} · ${voiceboxHealth.gpu_type ?? (voiceboxHealth.gpu_available ? "GPU" : "CPU")} · ${voiceboxHealth.model_loaded ? "model załadowany" : "model niezaładowany"}`
    : "Voice Box niedostępny";

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-panel">
      <Header onBack={onBackToTts} health={voiceboxHealth} statusLabel={statusLabel} />

      <nav className="shrink-0 flex border-b border-border bg-panel2/40">
        <SubTab
          active={section === "profiles"}
          onClick={() => setSection("profiles")}
          label={`Profile (${voiceboxProfiles.length})`}
        />
        <SubTab active={section === "history"} onClick={() => setSection("history")} label="Historia serwera" />
        <SubTab active={section === "tts_preset"} onClick={() => setSection("tts_preset")} label="Preset TTS" />
      </nav>

      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col gap-6 text-sm">
          {section === "profiles" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Profile Voice Box</h2>
                <p className="text-xs text-muted">
                  Profile głosu na serwerze Voice Box — tworzenie, edycja, próbki referencyjne i
                  personality. To nie to samo co „Profile głosu” w ustawieniach TTS Hub (presety
                  syntezy).
                </p>
              </header>
              <VoiceboxProfilesSection
                profiles={voiceboxProfiles}
                onRefresh={() => void onRefreshVoicebox()}
                onUseInTts={useProfileInTts}
                onAddToProfileList={addToProfileList}
                hubProfileIds={hubProfileIds}
                onError={onError}
                onSuccess={onSuccess}
              />
            </>
          )}

          {section === "history" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Historia Voice Box</h2>
                <p className="text-xs text-muted">
                  Generacje zapisane na serwerze Voice Box. Lokalna zakładka Historia w TTS Hub
                  pokazuje tylko generacje z tej aplikacji.
                </p>
              </header>
              <VoiceboxHistorySection
                profiles={voiceboxProfiles}
                onError={onError}
                onSuccess={onSuccess}
              />
            </>
          )}

          {section === "tts_preset" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Preset TTS (Voice Box)</h2>
                <p className="text-xs text-muted">
                  Szybki test syntezy z wybranym profilem Voice Box. Zapisz jako profil głosu TTS
                  Hub ze skrótem klawiszowym.
                </p>
              </header>
              <div className="border border-border rounded-md overflow-hidden bg-panel2/20">
                <Settings
                  state={{ ...settings, provider: "voicebox" }}
                  voices={voices}
                  voiceboxProfiles={voiceboxProfiles}
                  voiceboxModels={voiceboxModels}
                  voiceboxHealth={voiceboxHealth}
                  enabledProviders={enabledProviders}
                  onChange={onSettingsChange}
                  onError={onError}
                />
                <SaveVoiceProfileFooter
                  settings={{ ...settings, provider: "voicebox" }}
                  onError={onError}
                  onSuccess={onProfileSaved ?? onSuccess}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Header({
  onBack,
  health,
  statusLabel,
}: {
  onBack: () => void;
  health: VoiceBoxHealth | null;
  statusLabel?: string;
}) {
  return (
    <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-panel2/40">
      <button type="button" className="btn text-xs" onClick={onBack}>
        ← TTS
      </button>
      <div className="flex flex-col min-w-0">
        <h1 className="text-base font-semibold">Voice Box</h1>
        {statusLabel ? (
          <span className="text-[10px] text-muted truncate" title={statusLabel}>
            {statusLabel}
          </span>
        ) : health ? null : (
          <span className="text-[10px] text-muted">Serwer niedostępny</span>
        )}
      </div>
    </header>
  );
}

function SubTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`px-4 py-2 text-xs border-b-2 transition-colors ${
        active
          ? "border-accent text-heading bg-panel"
          : "border-transparent text-muted hover:text-heading"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
