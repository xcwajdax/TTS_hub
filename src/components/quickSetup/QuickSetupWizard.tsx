import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  closeQuickSetupWindow,
  getAppSettings,
  setAppSettings,
} from "../../api/tauri";
import type { AppSettings, AppSettingsView, TtsProviderId, VoiceboxServerMode } from "../../appSettings";
import { appSettingsViewToPayload, newApiProfile } from "../../appSettings";
import { isTauriApp } from "../../lib/tauriEnv";
import GoogleConfigStep from "./GoogleConfigStep";
import MinimaxConfigStep from "./MinimaxConfigStep";
import ProviderSelectStep from "./ProviderSelectStep";
import VoiceboxConfigStep from "./VoiceboxConfigStep";

type WizardStep = "providers" | TtsProviderId;

interface Props {
  /** Inline overlay in main window vs dedicated quick-setup window */
  mode?: "overlay" | "window";
  onClose?: () => void;
  onSaved?: () => void;
  onError?: (message: string) => void;
}

export default function QuickSetupWizard({
  mode = "overlay",
  onClose,
  onSaved,
  onError,
}: Props) {
  const [view, setView] = useState<AppSettingsView | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<TtsProviderId[]>(["google"]);
  const [googleKey, setGoogleKey] = useState("");
  const [googleProfileName, setGoogleProfileName] = useState("Profil Google");
  const [voiceboxUrl, setVoiceboxUrl] = useState("http://127.0.0.1:17493");
  const [voiceboxServerMode, setVoiceboxServerMode] = useState<VoiceboxServerMode>("bundled");
  const [minimaxKey, setMinimaxKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await getAppSettings();
      setView(v);
      const enabled = (v.enabled_providers ?? []) as TtsProviderId[];
      if (enabled.length > 0) setSelected(enabled);
      setVoiceboxUrl(
        v.voicebox_base_url?.trim() || v.effective_voicebox_url || "http://127.0.0.1:17493",
      );
      setVoiceboxServerMode(v.voicebox_server_mode ?? "bundled");
      setMinimaxKey(v.minimax_api_key ?? "");
      const activeProfile = v.api_profiles.find((p) => p.id === v.active_api_id);
      if (activeProfile) {
        setGoogleKey(activeProfile.api_key);
        setGoogleProfileName(activeProfile.name);
      } else if (v.api_profiles[0]) {
        setGoogleKey(v.api_profiles[0].api_key);
        setGoogleProfileName(v.api_profiles[0].name);
      }
    } catch (e) {
      onError?.(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const steps: WizardStep[] = useMemo(() => {
    const list: WizardStep[] = ["providers"];
    for (const p of selected) list.push(p);
    return list;
  }, [selected]);

  const currentStep = steps[stepIndex] ?? "providers";
  const isLast = stepIndex >= steps.length - 1;

  const buildPayload = (): AppSettings | null => {
    if (!view) return null;
    const base: AppSettings = {
      ...appSettingsViewToPayload(view),
      api_profiles: [...view.api_profiles],
      quick_setup_completed: true,
      enabled_providers: selected,
      voicebox_base_url: selected.includes("voicebox")
        ? voiceboxUrl.trim() || null
        : view.voicebox_base_url ?? null,
      voicebox_server_mode: selected.includes("voicebox")
        ? voiceboxServerMode
        : view.voicebox_server_mode ?? "external",
      minimax_api_key: selected.includes("minimax")
        ? minimaxKey.trim() || null
        : view.minimax_api_key ?? null,
    };

    if (selected.includes("google") && googleKey.trim()) {
      const existing = base.api_profiles[0];
      if (existing) {
        base.api_profiles = base.api_profiles.map((p, i) =>
          i === 0
            ? { ...p, name: googleProfileName.trim() || p.name, api_key: googleKey.trim() }
            : p,
        );
        base.active_api_id = existing.id;
      } else {
        const profile = newApiProfile(
          googleProfileName.trim() || "Profil Google",
          googleKey.trim(),
        );
        base.api_profiles = [profile, ...base.api_profiles];
        base.active_api_id = profile.id;
      }
    }

    return base;
  };

  const save = async (markComplete: boolean) => {
    if (!view || saving) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (!payload) return;
      if (!markComplete) {
        payload.quick_setup_completed = true;
      }
      await setAppSettings(payload);
      onSaved?.();
      if (mode === "window" && isTauriApp()) {
        await closeQuickSetupWindow();
        const win = getCurrentWebviewWindow();
        if (win.label === "quick-setup") await win.close();
      } else {
        onClose?.();
      }
    } catch (e) {
      onError?.(String(e));
    } finally {
      setSaving(false);
    }
  };

  const skipLater = async () => {
    if (!view || saving) return;
    setSaving(true);
    try {
      await setAppSettings({
        ...view,
        quick_setup_completed: true,
      });
      onClose?.();
    } catch (e) {
      onError?.(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!view) {
    return (
      <div className="p-6 text-sm text-muted">Ładowanie ustawień…</div>
    );
  }

  const stepTitle =
    currentStep === "providers"
      ? "Wybierz providery"
      : currentStep === "google"
        ? "Google Gemini"
        : currentStep === "voicebox"
          ? "Voice Box"
          : "MiniMax Portal";

  const shellClass =
    mode === "window"
      ? "flex flex-col h-full min-h-0 bg-bg text-fg"
      : "fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4";

  const panelClass =
    mode === "window"
      ? "flex flex-col flex-1 min-h-0"
      : "flex flex-col w-full max-w-lg max-h-[90vh] rounded-lg border border-border bg-bg shadow-xl overflow-hidden";

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <header className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Szybka konfiguracja</h2>
            <p className="text-xs text-muted">
              Krok {stepIndex + 1} / {steps.length}: {stepTitle}
            </p>
          </div>
          {mode === "overlay" && (
            <button type="button" className="btn text-xs" onClick={() => void skipLater()} disabled={saving}>
              Później
            </button>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {currentStep === "providers" && (
            <ProviderSelectStep selected={selected} onChange={setSelected} />
          )}
          {currentStep === "google" && (
            <GoogleConfigStep
              apiKey={googleKey}
              profileName={googleProfileName}
              envKeyAvailable={view.env_api_key_available}
              onApiKeyChange={setGoogleKey}
              onProfileNameChange={setGoogleProfileName}
            />
          )}
          {currentStep === "voicebox" && (
            <VoiceboxConfigStep
              baseUrl={voiceboxUrl}
              effectiveUrl={view.effective_voicebox_url}
              serverMode={voiceboxServerMode}
              onBaseUrlChange={setVoiceboxUrl}
              onServerModeChange={setVoiceboxServerMode}
            />
          )}
          {currentStep === "minimax" && (
            <MinimaxConfigStep
              apiKey={minimaxKey}
              envKeyAvailable={view.env_minimax_api_key_available}
              onApiKeyChange={setMinimaxKey}
            />
          )}
        </div>

        <footer className="shrink-0 flex justify-between gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            className="btn text-xs"
            disabled={stepIndex === 0 || saving}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Wstecz
          </button>
          <div className="flex gap-2">
            {mode === "window" && (
              <button type="button" className="btn text-xs" onClick={() => void skipLater()} disabled={saving}>
                Anuluj
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={saving || (currentStep === "providers" && selected.length === 0)}
                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              >
                Dalej
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={saving}
                onClick={() => void save(true)}
              >
                {saving ? "Zapisywanie…" : "Zakończ"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
