import type { ReactNode } from "react";
import Icon from "./Icon";
import { useAppStatus } from "../hooks/useAppStatus";
import { useJobs } from "../context/JobsContext";
import { isTauriApp } from "../lib/tauriEnv";

type StatusTone = "ok" | "warn" | "error" | "idle";

function toneFromBool(ok: boolean | null | undefined): StatusTone {
  if (ok === null || ok === undefined) return "idle";
  return ok ? "ok" : "error";
}

function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={`status-bar__dot status-bar__dot--${tone}`} aria-hidden />;
}

function StatusItem({
  icon,
  label,
  tone,
  title,
}: {
  icon?: ReactNode;
  label: string;
  tone: StatusTone;
  title?: string;
}) {
  return (
    <span className="status-bar__item" title={title}>
      {icon}
      <StatusDot tone={tone} />
      <span className="status-bar__label">{label}</span>
    </span>
  );
}

function formatVersion(version: string, gitHash: string | null | undefined): string {
  if (gitHash) return `v${version} · ${gitHash}`;
  return `v${version}`;
}

function voiceboxTone(status: string | undefined): StatusTone {
  if (!status) return "idle";
  const s = status.toLowerCase();
  if (s === "ok" || s === "healthy" || s === "ready") return "ok";
  if (s === "loading" || s === "starting") return "warn";
  return "error";
}

export default function AppStatusBar() {
  const { apiOk, mcp, cursor, voicebox, minimax, build } = useAppStatus();
  const { activeJobs } = useJobs();
  const inTauri = isTauriApp();

  const mcpTone: StatusTone = !inTauri
    ? "idle"
    : mcp?.configured
      ? apiOk
        ? "ok"
        : "warn"
      : "idle";

  const mcpLabel = !inTauri
    ? "MCP"
    : mcp?.configured
      ? "MCP skonfigurowany"
      : "MCP brak";

  const mcpTitle = mcp?.config_path
    ? `${mcp.scope ?? "config"}: ${mcp.config_path}`
    : "Brak wpisu ttshub-mcp w ~/.cursor/mcp.json";

  const cursorTone: StatusTone = !inTauri
    ? "idle"
    : cursor?.hooks_installed
      ? "ok"
      : "warn";

  const minimaxTone: StatusTone = !minimax
    ? "idle"
    : !minimax.configured
      ? "idle"
      : minimax.ok
        ? "ok"
        : "error";

  const queueCount = activeJobs.length;

  return (
    <footer className="status-bar" aria-label="Status aplikacji">
      <div className="status-bar__cluster status-bar__cluster--start">
        <StatusItem
          icon={<Icon name="source-http" size={12} className="status-bar__icon" />}
          label={apiOk ? "API gotowe" : apiOk === false ? "API offline" : "API…"}
          tone={toneFromBool(apiOk)}
          title="Lokalne HTTP API na 127.0.0.1:8765"
        />
        <StatusItem
          icon={<Icon name="clip-external" size={12} className="status-bar__icon" />}
          label={mcpLabel}
          tone={mcpTone}
          title={mcpTitle}
        />
        {inTauri && (
          <StatusItem
            icon={<Icon name="source-cursor" size={12} className="status-bar__icon" />}
            label={cursor?.hooks_installed ? "Cursor hooki" : "Cursor brak"}
            tone={cursorTone}
            title={
              cursor?.hooks_installed
                ? "Hooki Cursor zainstalowane"
                : "Zainstaluj hooki w Ustawienia → Cursor"
            }
          />
        )}
        {queueCount > 0 && (
          <StatusItem
            icon={<Icon name="spinner" size={12} className="status-bar__icon status-bar__icon--spin" />}
            label={queueCount === 1 ? "1 zadanie" : `${queueCount} zadań`}
            tone="warn"
            title="Aktywna kolejka generacji"
          />
        )}
      </div>

      <div className="status-bar__spacer" aria-hidden />

      <div className="status-bar__cluster status-bar__cluster--end">
        {inTauri && voicebox && (
          <StatusItem
            icon={<Icon name="provider-voicebox" size={12} className="status-bar__icon" />}
            label="Voicebox"
            tone={voiceboxTone(voicebox.status)}
            title={voicebox.gpu_compatibility_warning ?? voicebox.status}
          />
        )}
        {inTauri && minimax?.configured && (
          <StatusItem
            icon={<Icon name="provider-minimax" size={12} className="status-bar__icon" />}
            label="MiniMax"
            tone={minimaxTone}
            title={minimax.message}
          />
        )}
        <span className="status-bar__version" title="Wersja aplikacji">
          <span className="status-bar__hash" aria-hidden>
            #
          </span>
          {formatVersion(build?.version ?? "0.1.0", build?.git_hash)}
        </span>
      </div>
    </footer>
  );
}
