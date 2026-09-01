import { useEffect, useMemo, useState } from "react";
import Icon from "../../Icon";
import { getMcpIntegrationStatus } from "../../../api/tauri";
import type { McpIntegrationStatus } from "../../../appSettings";
import SettingsSection from "../components/SettingsSection";
import SettingsPageHeader from "../components/SettingsPageHeader";

interface Props {
  onError: (m: string) => void;
}

const STATUS_POLL_MS = 10_000;
const TTSHUB_BASE_URL = "http://127.0.0.1:8765";

const ENV_BASE_URL = TTSHUB_BASE_URL;
const ENV_DEFAULT_VOICE = "grzegorz_braun";
const ENV_DEFAULT_MODEL = "minimax:speech-2.8-hd";

const CURSOR_MCP_JSON = JSON.stringify(
  {
    mcpServers: {
      ttshub: {
        command: "uvx",
        args: ["--from", "ttshub-mcp-server", "ttshub-mcp"],
        env: {
          TTSHUB_BASE_URL: ENV_BASE_URL,
          TTSHUB_DEFAULT_VOICE: ENV_DEFAULT_VOICE,
          TTSHUB_DEFAULT_MODEL: ENV_DEFAULT_MODEL,
          TTSHUB_ORIGIN_USER_NAME: "cursor-user",
        },
      },
    },
  },
  null,
  2,
);

const CODEX_MCP_JSON = JSON.stringify(
  {
    mcp_servers: {
      ttshub: {
        command: "uvx",
        args: ["--from", "ttshub-mcp-server", "ttshub-mcp"],
        env: {
          TTSHUB_BASE_URL: ENV_BASE_URL,
          TTSHUB_DEFAULT_VOICE: ENV_DEFAULT_VOICE,
          TTSHUB_DEFAULT_MODEL: ENV_DEFAULT_MODEL,
          TTSHUB_ORIGIN_USER_NAME: "codex-user",
        },
      },
    },
  },
  null,
  2,
);

const HERMES_CONFIG_YAML = [
  "mcp_servers:",
  "  ttshub:",
  "    command: uvx",
  "    args:",
  '      - "--from"',
  "      - ttshub-mcp-server",
  "      - ttshub-mcp",
  "    env:",
  `      TTSHUB_BASE_URL: "${ENV_BASE_URL}"`,
  `      TTSHUB_DEFAULT_VOICE: "${ENV_DEFAULT_VOICE}"`,
  `      TTSHUB_DEFAULT_MODEL: "${ENV_DEFAULT_MODEL}"`,
  '      TTSHUB_ORIGIN_USER_NAME: "hermes-user"',
  "",
].join("\n");

const CLAUDE_CODE_CMD = [
  "claude mcp add ttshub --scope user \\",
  `  -e TTSHUB_BASE_URL=${ENV_BASE_URL} \\`,
  `  -e TTSHUB_DEFAULT_VOICE=${ENV_DEFAULT_VOICE} \\`,
  `  -e TTSHUB_DEFAULT_MODEL=${ENV_DEFAULT_MODEL} \\`,
  '  -e TTSHUB_ORIGIN_USER_NAME=claude-code-user \\',
  "  -- uvx --from ttshub-mcp-server ttshub-mcp",
].join("\n");

const OPENCODE_MCP_JSON = JSON.stringify(
  {
    mcp: {
      ttshub: {
        type: "local",
        command: ["uvx", "--from", "ttshub-mcp-server", "ttshub-mcp"],
        enabled: true,
        environment: {
          TTSHUB_BASE_URL: ENV_BASE_URL,
          TTSHUB_DEFAULT_VOICE: ENV_DEFAULT_VOICE,
          TTSHUB_DEFAULT_MODEL: ENV_DEFAULT_MODEL,
          TTSHUB_ORIGIN_USER_NAME: "opencode-user",
        },
      },
    },
  },
  null,
  2,
);

interface SnippetProps {
  label: string;
  path: string;
  code: string;
  language: "json" | "yaml" | "bash";
}

function CodeSnippet({ label, path, code, language }: SnippetProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-panel2/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-xs font-medium">{label}</span>
          <code className="text-[10px] text-muted break-all font-mono">{path}</code>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="btn text-[11px] flex items-center gap-1.5 shrink-0"
          aria-label={`Kopiuj ${label}`}
        >
          <Icon name="copy" size={14} className="opacity-90" />
          <span>{copied ? "Skopiowano" : "Kopiuj"}</span>
        </button>
      </div>
      <pre
        className="overflow-auto rounded border border-border bg-black/40 text-[11px] leading-relaxed font-mono p-2.5 text-heading/90 max-h-72"
        data-language={language}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function StatusPill({ status }: { status: McpIntegrationStatus | null }) {
  if (!status) {
    return (
      <span className="text-[11px] text-muted inline-flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted/60" />
        Sprawdzanie…
      </span>
    );
  }
  if (status.configured) {
    const scopeLabel =
      status.scope === "global"
        ? "globalny"
        : status.scope === "workspace"
          ? "workspace"
          : "wykryty";
    return (
      <span className="text-[11px] text-green-400/90 inline-flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400/80" />
        Skonfigurowany ({scopeLabel})
      </span>
    );
  }
  return (
    <span className="text-[11px] text-amber-400/90 inline-flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/80" />
      Nie wykryto konfiguracji ttshub-mcp w Cursorze
    </span>
  );
}

export default function McpPage({ onError }: Props) {
  const [status, setStatus] = useState<McpIntegrationStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = () => {
      getMcpIntegrationStatus()
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch((err) => {
          if (!cancelled) onError(`Nie udało się odczytać statusu MCP: ${String(err)}`);
        });
    };
    fetchStatus();
    const id = window.setInterval(fetchStatus, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onError]);

  const statusPath = useMemo(() => status?.config_path ?? null, [status]);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <SettingsPageHeader
        title="MCP — Model Context Protocol"
        description="Wystaw lokalne API TTS Hub jako narzędzia MCP, żeby inne programy (Cursor, Codex, Hermes, Claude Code) mogły generować mowę przez model AI."
      />

      <SettingsSection
        title="Status integracji"
        description="Wykrywanie konfiguracji ttshub-mcp w plikach Cursor (.cursor/mcp.json). Odświeżane automatycznie co 10 s."
      >
        <div className="rounded-md border border-border bg-panel2/30 px-3 py-2.5 flex flex-col gap-1.5">
          <StatusPill status={status} />
          {statusPath ? (
            <code className="text-[10px] text-muted break-all font-mono">{statusPath}</code>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wymagania"
        description="Serwer MCP to osobny pakiet Python uruchamiany przez uvx. TTS Hub musi działać lokalnie (okno Tauri)."
      >
        <ul className="text-xs text-muted leading-relaxed list-disc pl-5 flex flex-col gap-1">
          <li>
            <span className="text-ink/90">Python ≥ 3.11</span> oraz{" "}
            <code className="font-mono text-[11px]">uv</code> /{" "}
            <code className="font-mono text-[11px]">uvx</code> w PATH.
          </li>
          <li>
            <code className="font-mono text-[11px]">ttshub-mcp-server</code> opublikowany w
            PyPI (lub instalowalny lokalnie z{" "}
            <code className="font-mono text-[11px]">uvx --from …</code>).
          </li>
          <li>
            TTS Hub uruchomiony — backend HTTP nasłuchuje na{" "}
            <code className="font-mono text-[11px]">{TTSHUB_BASE_URL}</code>.
          </li>
          <li>
            Restart harnessu po edycji pliku konfiguracyjnego.
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection
        title="Snippety konfiguracji"
        description="Skopiuj odpowiedni fragment do pliku konfiguracyjnego swojego klienta MCP. Każdy harness ma inny format — nie ma jednego uniwersalnego JSON-a. Każdy blok dodaje serwer o nazwie 'ttshub'."
      >
        <div className="grid gap-3">
          <CodeSnippet
            label="Cursor — globalny (~/.cursor/mcp.json)"
            path="~/.cursor/mcp.json"
            code={CURSOR_MCP_JSON}
            language="json"
          />
          <CodeSnippet
            label="Cursor — workspace (<project>/.cursor/mcp.json)"
            path="<project>/.cursor/mcp.json"
            code={CURSOR_MCP_JSON}
            language="json"
          />
          <CodeSnippet
            label="Codex CLI (~/.codex/mcp_servers.json)"
            path="~/.codex/mcp_servers.json"
            code={CODEX_MCP_JSON}
            language="json"
          />
          <CodeSnippet
            label="Hermes (dopisz do ~/.hermes/config.yaml)"
            path="~/.hermes/config.yaml"
            code={HERMES_CONFIG_YAML}
            language="yaml"
          />
          <CodeSnippet
            label="OpenCode (opencode.json lub opencode.jsonc — globalnie lub w projekcie)"
            path="opencode.json / opencode.jsonc"
            code={OPENCODE_MCP_JSON}
            language="json"
          />
          <CodeSnippet
            label="Claude Code — komenda CLI"
            path="terminal (user-scope)"
            code={CLAUDE_CODE_CMD}
            language="bash"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Dostępne narzędzia MCP"
        description="Po podpięciu serwera harness widzi 7 narzędzi do generowania mowy i zarządzania zadaniami."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["ttshub_generate_speech", "Synteza mowy (text → audio, polling jobu)"],
            ["ttshub_list_voices", "Lista dostępnych głosów/profili"],
            ["ttshub_list_jobs", "Lista aktywnych zadań TTS"],
            ["ttshub_get_job_status", "Status pojedynczego zadania"],
            ["ttshub_cancel_job", "Anulowanie zadania"],
            ["ttshub_list_history", "Historia generacji (audio + metadane)"],
            ["ttshub_get_usage", "Statystyki zużycia tokenów"],
          ].map(([name, desc]) => (
            <div
              key={name}
              className="rounded border border-border bg-panel2/30 px-3 py-2 flex flex-col gap-0.5"
            >
              <code className="text-[11px] font-mono text-accent2">{name}</code>
              <span className="text-[11px] text-muted leading-snug">{desc}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}