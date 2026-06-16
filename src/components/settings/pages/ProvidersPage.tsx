import { openQuickSetupWindow } from "../../../api/tauri";
import {
  ALL_TTS_PROVIDERS,
  isProviderEnabled,
  type TtsProviderId,
  type VoiceboxServerMode,
} from "../../../appSettings";
import { useAppView } from "../../../context/AppViewContext";
import ProviderCard, { type ProviderStatus } from "../components/ProviderCard";
import SettingsPageHeader from "../components/SettingsPageHeader";
import SettingsSection from "../components/SettingsSection";
import GoogleProviderSection from "../providers/GoogleProviderSection";
import MinimaxProviderSection from "../providers/MinimaxProviderSection";
import ProviderEnableSection from "../providers/ProviderEnableSection";
import VoiceboxProviderSection from "../providers/VoiceboxProviderSection";
import { PROVIDER_LABELS } from "../providers/providerLabels";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
}

function providerStatus(
  id: TtsProviderId,
  view: SettingsView,
  enabled: TtsProviderId[],
): ProviderStatus {
  if (!isProviderEnabled(enabled, id)) return "disabled";
  if (id === "google") {
    if (view.env_api_key_available) return "configured";
    const active = view.api_profiles.find((p) => p.id === view.active_api_id);
    if (active?.api_key.trim()) return "configured";
    if (view.api_profiles.some((p) => p.api_key.trim())) return "configured";
    return "missing";
  }
  if (id === "voicebox") {
    const url = view.voicebox_base_url?.trim() || view.effective_voicebox_url;
    return url ? "configured" : "missing";
  }
  if (id === "minimax") {
    if (view.env_minimax_api_key_available || view.effective_minimax_configured) {
      return "configured";
    }
    return view.minimax_api_key?.trim() ? "configured" : "missing";
  }
  return "missing";
}

export default function ProvidersPage({ view, update, onError }: Props) {
  const { openMinimaxVoices, openVoiceboxView } = useAppView();
  const enabled = (view.enabled_providers?.length
    ? view.enabled_providers
    : ALL_TTS_PROVIDERS) as TtsProviderId[];

  const setEnabled = (next: TtsProviderId[]) => {
    update("enabled_providers", next);
  };

  return (
    <div className="flex flex-col gap-8 text-sm">
      <SettingsPageHeader
        title="Providery TTS"
        description="Konfiguracja silników syntezy mowy. Provider to usługa TTS (Google, Voice Box, Minimax). Profile API to klucze Google — osobna sprawa od profili głosu w zakładce Profile głosu. Zmiany zapisują się automatycznie."
      />

      <SettingsSection title="Włączone providery">
        <ProviderEnableSection selected={enabled} onChange={setEnabled} />
      </SettingsSection>

      <SettingsSection title="Konfiguracja providerów" borderTop>
        <div className="flex flex-col gap-3">
          <ProviderCard
            icon="provider-google"
            title={PROVIDER_LABELS.google.title}
            status={providerStatus("google", view, enabled)}
            defaultExpanded={isProviderEnabled(enabled, "google")}
          >
            <GoogleProviderSection
              mode="settings"
              profiles={view.api_profiles}
              activeId={view.active_api_id}
              envKeyAvailable={view.env_api_key_available}
              onActiveIdChange={(id) => update("active_api_id", id)}
              onProfilesChange={(profiles) => update("api_profiles", profiles)}
            />
          </ProviderCard>

          <ProviderCard
            icon="provider-voicebox"
            title={PROVIDER_LABELS.voicebox.title}
            status={providerStatus("voicebox", view, enabled)}
            defaultExpanded={isProviderEnabled(enabled, "voicebox")}
          >
            <VoiceboxProviderSection
              baseUrl={view.voicebox_base_url ?? ""}
              effectiveUrl={view.effective_voicebox_url}
              serverMode={(view.voicebox_server_mode ?? "external") as VoiceboxServerMode}
              onBaseUrlChange={(v) => update("voicebox_base_url", v.trim() || null)}
              onServerModeChange={(mode) => update("voicebox_server_mode", mode)}
              onOpenVoiceboxView={() => openVoiceboxView()}
            />
          </ProviderCard>

          <ProviderCard
            icon="provider-minimax"
            title={PROVIDER_LABELS.minimax.title}
            status={providerStatus("minimax", view, enabled)}
            defaultExpanded={isProviderEnabled(enabled, "minimax")}
          >
            <MinimaxProviderSection
              apiKey={view.minimax_api_key ?? ""}
              envKeyAvailable={view.env_minimax_api_key_available}
              effectiveConfigured={view.effective_minimax_configured}
              onApiKeyChange={(v) => update("minimax_api_key", v.trim() || null)}
              onOpenMinimaxVoices={openMinimaxVoices}
            />
          </ProviderCard>
        </div>
      </SettingsSection>

      <SettingsSection title="Kreator" borderTop>
        <p className="text-[11px] text-muted">
          Szybka konfiguracja przeprowadzi Cię krok po kroku przez wybór providerów i testy
          połączenia.
        </p>
        <button
          type="button"
          className="btn-primary text-xs self-start"
          onClick={() => {
            void openQuickSetupWindow().catch((e) => onError(String(e)));
          }}
        >
          Szybka konfiguracja…
        </button>
      </SettingsSection>
    </div>
  );
}
