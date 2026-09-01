import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  voiceboxServerLogClear,
  voiceboxServerLogSnapshot,
  voiceboxServerStatus,
  type VoiceboxLogLine,
  type VoiceboxServerStatus,
} from "../../api/tauri";
import { isMockUiMode } from "../../lib/mockUi/isMockUiMode";

interface Props {
  onError: (m: string) => void;
}

const MOCK_LINES: VoiceboxLogLine[] = [
  { ts: "12:00:01", stream: "system", line: "--- started dev Voicebox on 127.0.0.1:17493 ---" },
  { ts: "12:00:02", stream: "stdout", line: "INFO:     Started server process" },
  { ts: "12:00:03", stream: "stdout", line: "INFO:     Uvicorn running on http://127.0.0.1:17493" },
];

export default function VoiceboxServerLogPanel({ onError }: Props) {
  const [lines, setLines] = useState<VoiceboxLogLine[]>([]);
  const [server, setServer] = useState<VoiceboxServerStatus | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const refreshMeta = useCallback(async () => {
    if (isMockUiMode()) {
      setServer({
        mode: "bundled",
        base_url: "http://127.0.0.1:17493",
        reachable: true,
        bundled_spawn_ready: true,
      });
      setLines(MOCK_LINES);
      return;
    }
    try {
      const [s, snap] = await Promise.all([
        voiceboxServerStatus().catch(() => null),
        voiceboxServerLogSnapshot().catch(() => [] as VoiceboxLogLine[]),
      ]);
      setServer(s);
      setLines(snap);
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (isMockUiMode()) return;
    let unlisten: (() => void) | undefined;
    void listen<VoiceboxLogLine>("voicebox-server-log", (ev) => {
      setLines((prev) => {
        const next = [...prev, ev.payload];
        return next.length > 1000 ? next.slice(-1000) : next;
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, autoScroll]);

  const clear = async () => {
    if (isMockUiMode()) {
      setLines([]);
      return;
    }
    try {
      await voiceboxServerLogClear();
      setLines([]);
    } catch (e) {
      onError(String(e));
    }
  };

  const bundled = server?.mode === "bundled";

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {!bundled ? (
        <p className="text-xs text-amber-200/90 leading-snug rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          Live log jest dostępny tylko w trybie <strong>wbudowanym</strong> (TTS Hub uruchamia
          sidecar). W trybie zewnętrznym stdout idzie do osobnej aplikacji Voicebox.
        </p>
      ) : (
        <p className="text-[11px] text-muted leading-snug">
          Stdout/stderr lokalnego serwera Voice Box. Przydatne przy pobieraniu modeli i błędach
          startu.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn text-xs" onClick={() => void refreshMeta()}>
          Odśwież
        </button>
        <button type="button" className="btn text-xs" onClick={() => void clear()}>
          Wyczyść
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-muted ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>

      <pre
        ref={preRef}
        className="flex-1 min-h-[280px] max-h-[min(60vh,520px)] overflow-auto rounded-md border border-border bg-black/40 text-[11px] leading-relaxed font-mono p-3 text-heading/90"
      >
        {lines.length === 0 ? (
          <span className="text-muted">Brak linii w buforze. Uruchom serwer w trybie wbudowanym.</span>
        ) : (
          lines.map((l, i) => (
            <div
              key={`${l.ts}-${i}-${l.line.slice(0, 24)}`}
              className={
                l.stream === "stderr"
                  ? "text-red-300/90"
                  : l.stream === "system"
                    ? "text-amber-200/80"
                    : "text-heading/85"
              }
            >
              <span className="text-muted/70 select-none">{l.ts} </span>
              <span className="text-muted/50 select-none">[{l.stream}] </span>
              {l.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
