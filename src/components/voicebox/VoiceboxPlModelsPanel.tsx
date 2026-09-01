import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  voiceboxCancelModelDownload,
  voiceboxDownloadModel,
  voiceboxListPlModelStatus,
  voiceboxServerInstall,
  voiceboxServerStart,
  voiceboxServerStatus,
  voiceboxUnloadModel,
  type VoiceBoxHealth,
  type VoiceBoxModelProgressEvent,
  type VoiceBoxPlModelStatus,
  type VoiceboxServerStatus,
} from "../../api/tauri";
import { isMockUiMode } from "../../lib/mockUi/isMockUiMode";
import {
  voiceboxInstanceKindLabel,
  voiceboxStorageHint,
} from "../../lib/voiceboxConnection";
import {
  statusForCard,
  VOICEBOX_PL_MODEL_CARDS,
  type VoiceboxPlModelCard,
} from "../../lib/voiceboxPlModels";

interface Props {
  health?: VoiceBoxHealth | null;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onCreateCloneProfile?: (opts: {
    default_engine: "chatterbox" | "tada";
    tada_size?: "1B" | "3B";
  }) => void;
  onOpenSettings?: () => void;
  onOpenLog?: () => void;
}

const MOCK_STATUSES: VoiceBoxPlModelStatus[] = VOICEBOX_PL_MODEL_CARDS.map((c, i) => ({
  model_name: c.model_name,
  display_name: c.title,
  hub_model_id:
    c.model_name === "chatterbox-tts"
      ? "voicebox:chatterbox"
      : c.model_name === "tada-1b"
        ? "voicebox:tada-1b"
        : "voicebox:tada-3b-ml",
  engine: c.default_engine,
  model_size: c.tada_size ?? null,
  downloaded: i === 0,
  downloading: false,
  loaded: false,
  size_mb: i === 0 ? 3200 : null,
  progress: null,
  bytes_current: null,
  bytes_total: null,
  filename: null,
}));

function formatBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 0.1) return `${gb.toFixed(2)} GB`;
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function shortName(name: string | null | undefined): string {
  if (!name) return "";
  const base = name.split(/[/\\]/).pop() ?? name;
  return base.length > 48 ? `${base.slice(0, 45)}…` : base;
}

export default function VoiceboxPlModelsPanel({
  health,
  onError,
  onSuccess,
  onCreateCloneProfile,
  onOpenSettings,
  onOpenLog,
}: Props) {
  const [statuses, setStatuses] = useState<VoiceBoxPlModelStatus[]>([]);
  const [server, setServer] = useState<VoiceboxServerStatus | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isMockUiMode()) {
      setStatuses(MOCK_STATUSES);
      setServer({
        mode: "external",
        base_url: "http://127.0.0.1:17493",
        reachable: true,
        bundled_spawn_ready: false,
        health_status: "ok",
      });
      setLoading(false);
      return;
    }
    try {
      const [s, st] = await Promise.all([
        voiceboxServerStatus().catch(() => null),
        voiceboxListPlModelStatus().catch(() => [] as VoiceBoxPlModelStatus[]),
      ]);
      setServer(s);
      setStatuses(st);
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (isMockUiMode()) return;
    let unlisten: (() => void) | undefined;
    void listen<VoiceBoxModelProgressEvent>("voicebox-model-progress", (ev) => {
      const p = ev.payload;
      setStatuses((prev) =>
        prev.map((m) => {
          if (m.model_name !== p.model_name) return m;
          const nextProgress =
            p.downloading && p.progress != null
              ? Math.max(m.progress ?? 0, p.progress)
              : p.progress;
          return {
            ...m,
            downloading: p.downloading,
            downloaded: p.downloaded,
            loaded: p.loaded,
            progress: nextProgress,
            bytes_current: p.bytes_current ?? m.bytes_current,
            bytes_total: p.bytes_total ?? m.bytes_total,
            filename: p.filename ?? m.filename,
          };
        }),
      );
      if (p.error) onError(p.error);
      if (p.downloaded && !p.downloading) {
        onSuccess?.(`Model ${p.model_name} jest gotowy.`);
        void refresh();
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [onError, onSuccess, refresh]);

  const startServer = async () => {
    setBusyName("__server__");
    try {
      const s = await voiceboxServerStart();
      setServer(s);
      if (!s.reachable) {
        onError(s.message || "Nie udało się uruchomić serwera Voice Box.");
      } else {
        onSuccess?.("Serwer Voice Box działa.");
        await refresh();
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyName(null);
    }
  };

  const installServer = async () => {
    setBusyName("__install__");
    try {
      onSuccess?.(
        "Instalacja silnika lokalnego… To może potrwać kilka–kilkanaście minut (torch + zależności). Postęp w zakładce Log.",
      );
      onOpenLog?.();
      const s = await voiceboxServerInstall();
      setServer(s);
      onSuccess?.(s.message || "Instalacja zakończona.");
      await refresh();
    } catch (e) {
      onError(String(e));
      await refresh();
    } finally {
      setBusyName(null);
    }
  };

  const download = async (modelName: string) => {
    setBusyName(modelName);
    try {
      await voiceboxDownloadModel(modelName);
      setStatuses((prev) =>
        prev.map((m) =>
          m.model_name === modelName
            ? {
                ...m,
                downloading: true,
                downloaded: false,
                progress: m.progress ?? 0,
              }
            : m,
        ),
      );
      onSuccess?.(`Pobieranie ${modelName}…`);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyName(null);
    }
  };

  const cancel = async (modelName: string) => {
    setBusyName(modelName);
    try {
      await voiceboxCancelModelDownload(modelName);
      onSuccess?.("Anulowano pobieranie.");
      await refresh();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyName(null);
    }
  };

  const unload = async (modelName: string) => {
    setBusyName(modelName);
    try {
      await voiceboxUnloadModel(modelName);
      onSuccess?.("Zwolniono model z pamięci.");
      await refresh();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusyName(null);
    }
  };

  const reachable = server?.reachable === true;
  const anyDownloading = statuses.some((s) => s.downloading);
  const needsInstall =
    !reachable &&
    server?.dev_install_available === true &&
    server?.dev_venv_ready !== true;
  const installing =
    busyName === "__install__" || server?.installing === true;
  const serverBusy = busyName === "__server__" || installing;
  const gpuLabel = health
    ? (health.gpu_type ?? (health.gpu_available ? "GPU" : "CPU"))
    : null;
  const healthBits = [
    health?.status ?? server?.health_status,
    gpuLabel,
    health?.model_loaded === true
      ? "model załadowany"
      : health?.model_loaded === false
        ? "model niezaładowany"
        : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {reachable && server ? (
        <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-xs flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-emerald-300 font-medium">Połączenie sprawne</span>
            {healthBits.length > 0 ? (
              <span className="text-muted">{healthBits.join(" · ")}</span>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-heading/90">
            Tryb: {voiceboxInstanceKindLabel(server.mode)}. Adres:{" "}
            <code className="font-mono text-[11px] break-all">{server.base_url}</code>
          </p>
          <p className="text-[11px] leading-snug text-muted">{voiceboxStorageHint()}</p>
          <div className="flex flex-wrap gap-2">
            {onOpenSettings ? (
              <button type="button" className="btn text-xs" onClick={onOpenSettings}>
                Zmień adres / tryb
              </button>
            ) : null}
            <button type="button" className="btn text-xs" onClick={() => void refresh()}>
              Odśwież
            </button>
          </div>
        </div>
      ) : !loading ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs flex flex-col gap-2">
          <p className="text-amber-100/95 leading-snug">
            {needsInstall
              ? "Lokalny silnik Voice Box nie jest jeszcze zainstalowany (brak .venv). Zainstaluj zależności Pythona, potem uruchom silnik — albo sprawdź zewnętrzny serwer w ustawieniach."
              : "Serwer Voice Box jest niedostępny. Uruchom lokalny silnik (tryb wbudowany) albo sprawdź adres zewnętrznego serwera w ustawieniach."}
          </p>
          {server?.base_url ? (
            <p className="text-[11px] text-amber-200/90 leading-snug">
              Ostatni adres:{" "}
              <code className="font-mono text-[11px] break-all">{server.base_url}</code>
            </p>
          ) : null}
          {server?.message ? (
            <p className="text-[11px] text-amber-200/80 leading-snug font-mono break-all">
              {server.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {needsInstall ? (
              <button
                type="button"
                className="btn text-xs"
                disabled={serverBusy}
                onClick={() => void installServer()}
              >
                {installing ? "Instaluję…" : "Zainstaluj silnik lokalny"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn text-xs"
              disabled={serverBusy || needsInstall}
              onClick={() => void startServer()}
            >
              {busyName === "__server__" ? "…" : "Uruchom lokalny silnik"}
            </button>
            {onOpenSettings ? (
              <button type="button" className="btn text-xs" onClick={onOpenSettings}>
                Ustawienia Voice Box
              </button>
            ) : null}
            {onOpenLog ? (
              <button type="button" className="btn text-xs" onClick={onOpenLog}>
                Pokaż log
              </button>
            ) : null}
          </div>
          {needsInstall ? (
            <p className="text-[10px] text-muted leading-snug">
              Wymaga Pythona 3.11+ w PATH. Instalacja pobiera m.in. torch — potrzebny internet i sporo
              miejsca na dysku.
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="text-xs text-muted">Ładuję status modeli…</p> : null}

      <div className="flex flex-col gap-3">
        {VOICEBOX_PL_MODEL_CARDS.map((card) => (
          <ModelCard
            key={card.model_name}
            card={card}
            status={statusForCard(statuses, card.model_name)}
            reachable={reachable}
            busy={busyName === card.model_name}
            onDownload={() => void download(card.model_name)}
            onCancel={() => void cancel(card.model_name)}
            onUnload={() => void unload(card.model_name)}
            onCreateProfile={
              onCreateCloneProfile
                ? () =>
                    onCreateCloneProfile({
                      default_engine: card.default_engine,
                      tada_size: card.tada_size,
                    })
                : undefined
            }
          />
        ))}
      </div>

      {onOpenLog ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <button type="button" className="btn text-xs" onClick={onOpenLog}>
            Pokaż log serwera
          </button>
          {anyDownloading ? (
            <span className="text-amber-200/90">
              Podczas pobierania szczegóły HF/tqdm widać też w logu.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ModelCard({
  card,
  status,
  reachable,
  busy,
  onDownload,
  onCancel,
  onUnload,
  onCreateProfile,
}: {
  card: VoiceboxPlModelCard;
  status: VoiceBoxPlModelStatus | undefined;
  reachable: boolean;
  busy: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onUnload: () => void;
  onCreateProfile?: () => void;
}) {
  const downloading = status?.downloading ?? false;
  const downloaded = status?.downloaded ?? false;
  const loaded = status?.loaded ?? false;
  const progress = status?.progress;
  const pct = progress != null ? Math.min(100, Math.max(0, progress)) : null;

  let stateLabel = "Niepobrany na serwerze";
  let stateClass = "text-muted";
  if (downloading) {
    stateLabel = pct != null ? `Pobieranie ${Math.round(pct)}%` : "Pobieranie…";
    stateClass = "text-amber-200";
  } else if (loaded) {
    stateLabel = "W RAM serwera";
    stateClass = "text-emerald-300";
  } else if (downloaded) {
    stateLabel = "Na dysku serwera";
    stateClass = "text-emerald-300";
  }

  return (
    <article className="rounded-md border border-border bg-panel2/30 px-4 py-3.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{card.title}</h3>
            {card.recommended ? (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300/90">
                Zalecany
              </span>
            ) : null}
            <span className="text-[10px] text-muted">{card.sizeHint}</span>
          </div>
          <p className="text-xs text-muted leading-snug">{card.blurb}</p>
          {card.warn ? (
            <p className="text-[11px] text-amber-200/85 leading-snug">{card.warn}</p>
          ) : null}
        </div>
        <span className={`text-[11px] font-medium shrink-0 ${stateClass}`}>{stateLabel}</span>
      </div>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 rounded-full bg-panel overflow-hidden border border-border/40">
            <div
              className="h-full bg-[var(--accent,#6ee7b7)] transition-[width] duration-500 ease-out"
              style={{ width: `${pct != null ? Math.max(2, pct) : 4}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-[10px] text-muted font-mono">
            <span>
              {formatBytes(status?.bytes_current)} / {formatBytes(status?.bytes_total)}
            </span>
            <span className="truncate max-w-[60%]" title={status?.filename ?? undefined}>
              {shortName(status?.filename) || "…"}
            </span>
          </div>
        </div>
      ) : null}

      {!downloading && status?.size_mb != null && downloaded ? (
        <p className="text-[10px] text-muted">Na dysku serwera: ~{Math.round(status.size_mb)} MB</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!downloaded && !downloading ? (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={!reachable || busy}
            onClick={onDownload}
          >
            {busy ? "…" : "Pobierz"}
          </button>
        ) : null}
        {downloading ? (
          <button
            type="button"
            className="btn text-xs"
            disabled={!reachable || busy}
            onClick={onCancel}
          >
            Anuluj
          </button>
        ) : null}
        {loaded ? (
          <button
            type="button"
            className="btn text-xs"
            disabled={!reachable || busy}
            onClick={onUnload}
          >
            Zwolnij z pamięci
          </button>
        ) : null}
        {downloaded && onCreateProfile ? (
          <button type="button" className="btn text-xs" onClick={onCreateProfile}>
            Utwórz profil klonu (PL)
          </button>
        ) : null}
      </div>
    </article>
  );
}
