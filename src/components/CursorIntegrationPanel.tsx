import { useCallback, useEffect, useState } from "react";
import {
  exportCursorHookConfig,
  generate,
  getCursorIntegrationStatus,
  installCursorHooks,
  LOCAL_API_BASE,
  revealInExplorer,
  setCursorDnd,
  setCursorIntegration,
  uninstallCursorHooks,
} from "../api/tauri";
import type { CursorIntegration, CursorIntegrationStatus } from "../appSettings";
import { FALLBACK_TTS_MODELS } from "../ttsModels";

interface Props {
  value: CursorIntegration;
  onChange: (next: CursorIntegration) => void;
  voices: string[];
  onError: (e: string) => void;
}

const DND_PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "60 min", minutes: 60 },
  { label: "Wyłącz", minutes: 0 },
];

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatRelativeRemaining(ts: number | null | undefined): string {
  if (!ts) return "";
  const now = Date.now();
  if (ts <= now) return "";
  const mins = Math.ceil((ts - now) / 60_000);
  return `${mins} min`;
}

export default function CursorIntegrationPanel({ value, onChange, voices, onError }: Props) {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CursorIntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getCursorIntegrationStatus();
      setStatus(s);
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  const pingApi = useCallback(async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/health`, { cache: "no-store" });
      setApiOk(res.ok);
    } catch {
      setApiOk(false);
    }
  }, []);

  useEffect(() => {
    void pingApi();
    void refreshStatus();
    const id = window.setInterval(() => {
      void pingApi();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [pingApi, refreshStatus]);

  const update = <K extends keyof CursorIntegration>(key: K, val: CursorIntegration[K]) => {
    onChange({ ...value, [key]: val });
  };

  const persistNow = async (next: CursorIntegration) => {
    try {
      await setCursorIntegration(next);
      await exportCursorHookConfig();
    } catch (e) {
      onError(String(e));
    }
  };

  const handleToggle = (key: "enabled" | "autoplay" | "use_summary_markers", val: boolean) => {
    const next = { ...value, [key]: val };
    onChange(next);
    void persistNow(next);
  };

  const handleInstall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const report = await installCursorHooks();
      await refreshStatus();
      const next = { ...value, enabled: true, last_install_ts: report.ts };
      onChange(next);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await uninstallCursorHooks(false, false);
      await refreshStatus();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDnd = async (minutes: number) => {
    try {
      const ts = await setCursorDnd(minutes);
      onChange({ ...value, dnd_until_ts: ts });
    } catch (e) {
      onError(String(e));
    }
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      await generate({
        text: "Krótkie podsumowanie testowe z TTS Hub. Integracja Cursor działa poprawnie.",
        model: value.model,
        voice: value.voice,
        style: value.style ?? null,
        format: "wav",
        autoplay: true,
        source: "cursor",
        summary_text: "Krótkie podsumowanie testowe z TTS Hub. Integracja Cursor działa poprawnie.",
      });
    } catch (e) {
      onError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const openLog = async () => {
    try {
      const logPath = "%TEMP%\\cursor-tts\\cursor-tts.log";
      await revealInExplorer(logPath);
    } catch (e) {
      onError(String(e));
    }
  };

  const dndActive = !!(value.dnd_until_ts && value.dnd_until_ts > Date.now());

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-wide text-muted">Integracja Cursor</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <StatusPill label="HTTP API (127.0.0.1:8765)" ok={apiOk} fallback="…" />
        <StatusPill
          label={status?.hooks_installed ? "Hooki Cursor zainstalowane" : "Hooki Cursor niezainstalowane"}
          ok={status?.hooks_installed ?? null}
          fallback="…"
        />
        <StatusPill
          label={status?.pwsh_available ? "PowerShell 7 (pwsh)" : "Brak pwsh"}
          ok={status?.pwsh_available ?? null}
          fallback="…"
        />
        <div className="text-[11px] text-muted self-center">
          Ostatnia instalacja: {formatTs(status?.last_install_ts)}
          {status?.last_cursor_at ? ` · Ostatnia Cursor: ${formatTs(status.last_cursor_at)}` : ""}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => handleToggle("enabled", e.target.checked)}
        />
        <span>Integracja włączona</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.autoplay}
          onChange={(e) => handleToggle("autoplay", e.target.checked)}
        />
        <span>Automatycznie odtwarzaj podsumowania z Cursor</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.use_summary_markers}
          onChange={(e) => handleToggle("use_summary_markers", e.target.checked)}
        />
        <span>
          Preferuj markery <code className="text-[11px]">&lt;!-- tts-summary --&gt;</code>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
        Maks. liczba zdań w podsumowaniu
        <input
          type="number"
          className="field"
          min={1}
          max={20}
          value={value.max_sentences}
          onChange={(e) => update("max_sentences", Math.max(1, Math.min(20, Number(e.target.value) || 10)))}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Model TTS
          <select
            className="field"
            value={value.model}
            onChange={(e) => update("model", e.target.value)}
          >
            {FALLBACK_TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Głos
          <select
            className="field"
            value={value.voice}
            onChange={(e) => update("voice", e.target.value)}
          >
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Styl (prefix do podsumowania)
        <input
          type="text"
          className="field"
          value={value.style ?? ""}
          onChange={(e) => update("style", e.target.value || null)}
          placeholder="np. Powiedz spokojnie po polsku:"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">
          Tryb „nie przeszkadzać"{dndActive ? ` — aktywny (${formatRelativeRemaining(value.dnd_until_ts)})` : ""}
        </span>
        <div className="flex gap-1 flex-wrap">
          {DND_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn text-xs"
              onClick={() => void handleDnd(p.minutes)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => void handleInstall()}
          disabled={busy || !status?.pwsh_available}
          title={!status?.pwsh_available ? "Wymagany PowerShell 7 (pwsh) na PATH" : ""}
        >
          {busy ? "Pracuję…" : status?.hooks_installed ? "Odśwież hooki Cursor" : "Zainstaluj hooki Cursor"}
        </button>
        {status?.hooks_installed && (
          <button type="button" className="btn text-xs" onClick={() => void handleUninstall()} disabled={busy}>
            Odinstaluj hooki
          </button>
        )}
        <button type="button" className="btn text-xs" onClick={() => void handleTest()} disabled={testing || !value.enabled}>
          {testing ? "Testuję…" : "Test (autoplay)"}
        </button>
        <button type="button" className="btn text-xs" onClick={() => void openLog()}>
          Otwórz log hooków
        </button>
      </div>

      <div className="text-[11px] text-muted flex flex-col gap-0.5 pt-1">
        <span>Skrypt: <code>{status?.ps1_path ?? "—"}</code></span>
        <span>Hooks JSON: <code>{status?.hooks_json_path ?? "—"}</code></span>
        <span>Config: <code>{status?.tts_hub_config_path ?? "—"}</code></span>
      </div>
    </section>
  );
}

function StatusPill({
  label,
  ok,
  fallback,
}: {
  label: string;
  ok: boolean | null;
  fallback: string;
}) {
  const color =
    ok === null
      ? "bg-panel2 text-muted"
      : ok
      ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
      : "bg-red-900/40 text-red-300 border border-red-700/40";
  return (
    <span className={`px-2 py-1 rounded text-[11px] ${color}`}>
      {ok === null ? `${label}: ${fallback}` : label}
    </span>
  );
}
