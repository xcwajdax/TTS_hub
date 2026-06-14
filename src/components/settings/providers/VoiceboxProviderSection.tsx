import { useCallback, useEffect, useState } from "react";
import {
  listVoiceboxModels,
  probeVoicebox,
  voiceboxServerStart,
  voiceboxServerStatus,
  voiceboxServerStop,
} from "../../../api/tauri";
import type { ProbeResult, VoiceboxServerStatus } from "../../../api/tauri";
import type { VoiceboxServerMode } from "../../../appSettings";
import ProbeStatus from "../../quickSetup/ProbeStatus";
import QuickSetupHelp from "../../quickSetup/QuickSetupHelp";

interface Props {
  baseUrl: string;
  effectiveUrl?: string;
  serverMode?: VoiceboxServerMode;
  onBaseUrlChange: (v: string) => void;
  onServerModeChange?: (mode: VoiceboxServerMode) => void;
  onOpenVoiceboxView?: () => void;
}

function modeLabel(mode: VoiceboxServerMode): string {
  switch (mode) {
    case "bundled":
      return "Wbudowany (fork Voicebox)";
    case "disabled":
      return "Wyłączony";
    default:
      return "Zewnętrzny serwer";
  }
}

export default function VoiceboxProviderSection({
  baseUrl,
  effectiveUrl,
  serverMode = "external",
  onBaseUrlChange,
  onServerModeChange,
  onOpenVoiceboxView,
}: Props) {
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [serverStatus, setServerStatus] = useState<VoiceboxServerStatus | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [modelCount, setModelCount] = useState<number | null>(null);

  const refreshServerStatus = useCallback(async () => {
    try {
      const s = await voiceboxServerStatus();
      setServerStatus(s);
      if (s.reachable) {
        const models = await listVoiceboxModels().catch(() => []);
        setModelCount(models.length);
      } else {
        setModelCount(null);
      }
    } catch {
      setServerStatus(null);
    }
  }, []);

  useEffect(() => {
    void refreshServerStatus();
  }, [refreshServerStatus, serverMode]);

  const runTest = async () => {
    setProbing(true);
    setResult(null);
    try {
      const url = baseUrl.trim() || effectiveUrl || "http://127.0.0.1:17493";
      const r = await probeVoicebox(url);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setProbing(false);
      void refreshServerStatus();
    }
  };

  const startServer = async () => {
    setServerBusy(true);
    try {
      const s = await voiceboxServerStart();
      setServerStatus(s);
      if (s.reachable) {
        const models = await listVoiceboxModels().catch(() => []);
        setModelCount(models.length);
      }
    } catch (e) {
      setServerStatus({
        mode: serverMode,
        base_url: effectiveUrl ?? "http://127.0.0.1:17493",
        reachable: false,
        bundled_spawn_ready: false,
        message: String(e),
      });
    } finally {
      setServerBusy(false);
    }
  };

  const stopServer = async () => {
    setServerBusy(true);
    try {
      await voiceboxServerStop();
      await refreshServerStatus();
    } finally {
      setServerBusy(false);
    }
  };

  const showExternalUrl = serverMode === "external";

  return (
    <div className="flex flex-col gap-4">
      {onServerModeChange ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tryb serwera Voice Box
          <select
            className="field text-sm"
            value={serverMode}
            onChange={(e) => onServerModeChange(e.target.value as VoiceboxServerMode)}
          >
            <option value="bundled">Wbudowany — TTS Hub uruchamia fork backendu</option>
            <option value="external">Zewnętrzny — osobna aplikacja Voicebox</option>
            <option value="disabled">Wyłączony</option>
          </select>
          <span className="text-[10px] text-muted/80">{modeLabel(serverMode)}</span>
        </label>
      ) : null}

      {serverMode === "bundled" && serverStatus ? (
        <div className="rounded-md border border-border/60 bg-surface/40 px-3 py-2 text-[11px] flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                serverStatus.reachable
                  ? "text-emerald-400"
                  : serverStatus.bundled_spawn_ready
                    ? "text-amber-300"
                    : "text-red-400"
              }
            >
              {serverStatus.reachable
                ? "● Serwer działa"
                : serverStatus.bundled_spawn_ready
                  ? "○ Serwer zatrzymany"
                  : "○ Sidecar niedostępny"}
            </span>
            {serverStatus.health_status ? (
              <span className="text-muted">({serverStatus.health_status})</span>
            ) : null}
          </div>
          {serverStatus.message ? (
            <p className="text-muted leading-snug">{serverStatus.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="btn text-xs"
              disabled={serverBusy || !serverStatus.bundled_spawn_ready}
              onClick={() => void startServer()}
            >
              {serverBusy ? "…" : "Uruchom serwer"}
            </button>
            <button
              type="button"
              className="btn text-xs"
              disabled={serverBusy}
              onClick={() => void stopServer()}
            >
              Zatrzymaj
            </button>
            <button
              type="button"
              className="btn text-xs"
              disabled={serverBusy}
              onClick={() => void refreshServerStatus()}
            >
              Odśwież status
            </button>
          </div>
          {serverStatus.reachable && modelCount === 0 ? (
            <p className="text-amber-200/90 pt-1 leading-snug">
              Brak pobranych modeli TTS. Otwórz Voice Box → pobierz model (np. Chatterbox lub
              Kokoro). Pełna aplikacja{" "}
              <a
                className="underline"
                href="https://github.com/jamiepine/voicebox"
                target="_blank"
                rel="noreferrer"
              >
                Voicebox
              </a>{" "}
              nadal oferuje STT, dyktowanie i Stories.
            </p>
          ) : null}
        </div>
      ) : null}

      {showExternalUrl ? (
        <>
          {effectiveUrl && !baseUrl.trim() ? (
            <p className="text-[11px] text-muted">
              Aktywny adres: <code className="text-[10px]">{effectiveUrl}</code>
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Adres serwera Voice Box
            <input
              className="field font-mono text-sm"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder={effectiveUrl || "http://127.0.0.1:17493"}
            />
          </label>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn text-xs"
          onClick={() => void runTest()}
          disabled={probing || serverMode === "disabled"}
        >
          {probing ? "Testuję…" : "Testuj połączenie"}
        </button>
        <ProbeStatus probing={probing} result={result} />
      </div>
      {onOpenVoiceboxView ? (
        <button type="button" className="btn text-xs self-start" onClick={onOpenVoiceboxView}>
          Zarządzaj profilami Voice Box →
        </button>
      ) : null}
      <QuickSetupHelp topic="voicebox" />
    </div>
  );
}
