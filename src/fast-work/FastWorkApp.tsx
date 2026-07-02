import { useCallback, useEffect, useRef, useState } from "react";
import {
  fastWorkGenerate,
  fastWorkGetSettings,
  fastWorkListSessionHistory,
  fastWorkNewOutputFolder,
  fastWorkOpenOutputFolder,
  fastWorkPickOutputFolder,
  fastWorkSetShortcut,
  fastWorkAudioSrc,
  onFastWorkError,
  onFastWorkGenerated,
} from "./api";
import type { FastWorkGeneration, FastWorkSettingsView } from "./types";
import { SHORTCUT_QUICK_PICKS, shortcutDisplayLabel } from "../lib/quickHotkeyPreset";

export default function FastWorkApp() {
  const [settings, setSettings] = useState<FastWorkSettingsView | null>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<FastWorkGeneration[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    const [s, h] = await Promise.all([fastWorkGetSettings(), fastWorkListSessionHistory()]);
    setSettings(s);
    setShortcutDraft(s.shortcut ?? "");
    setHistory(h);
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    void onFastWorkGenerated((gen) => {
      setHistory((prev) => {
        const idx = prev.findIndex((g) => g.id === gen.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = gen;
          return next;
        }
        return [gen, ...prev];
      });
      setBusy(false);
    });
    void onFastWorkError((msg) => {
      setError(msg);
      setBusy(false);
    });
  }, [refresh]);

  const handleGenerate = async () => {
    if (!text.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const gen = await fastWorkGenerate(text);
      setHistory((prev) => {
        const idx = prev.findIndex((g) => g.id === gen.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = gen;
          return next;
        }
        return [gen, ...prev];
      });
      if (gen.status === "failed" && gen.error) {
        setError(gen.error);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveShortcut = async () => {
    setError(null);
    try {
      const s = await fastWorkSetShortcut(shortcutDraft.trim() || null);
      setSettings(s);
      setShortcutDraft(s.shortcut ?? "");
    } catch (e) {
      setError(String(e));
    }
  };

  const handlePlay = (gen: FastWorkGeneration) => {
    if (!gen.filePath || gen.status !== "done") return;
    if (playingId === gen.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const audio = new Audio(fastWorkAudioSrc(gen.filePath));
    audioRef.current = audio;
    setPlayingId(gen.id);
    void audio.play();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setError("Nie udało się odtworzyć pliku.");
    };
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="shrink-0 px-4 py-3 border-b border-border bg-panel/80">
        <h1 className="text-sm font-semibold tracking-tight">TTS Hub Fast Work</h1>
        {settings ? (
          <p className="text-[11px] text-muted mt-0.5 truncate" title={settings.profileName}>
            Profil: <span className="text-foreground">{settings.profileName}</span>
            <span className="text-muted/70"> · MiniMax · {settings.saveFormat.toUpperCase()}</span>
          </p>
        ) : null}
      </header>

      <main className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
        {error ? (
          <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded px-2 py-1.5">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-muted" htmlFor="fw-text">
            Tekst
          </label>
          <textarea
            id="fw-text"
            className="w-full min-h-[120px] resize-y rounded-md border border-border bg-panel2/40 px-3 py-2 text-sm focus:outline-none focus:border-accent/60"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wpisz tekst do syntezy…"
            disabled={busy}
          />
          <button
            type="button"
            className="self-start px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            disabled={busy || !text.trim()}
            onClick={() => void handleGenerate()}
          >
            {busy ? "Generuję…" : "Generuj"}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 border border-border/60 rounded-md p-2.5 bg-panel/30">
          <p className="text-[10px] uppercase tracking-wide text-muted">Skrót globalny</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            <input
              type="text"
              className="flex-1 min-w-[140px] rounded border border-border bg-panel2/40 px-2 py-1 text-xs font-mono"
              value={shortcutDraft}
              onChange={(e) => setShortcutDraft(e.target.value)}
              placeholder="np. Ctrl+Alt+F"
            />
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border hover:border-accent/50"
              onClick={() => void handleSaveShortcut()}
            >
              Zapisz
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SHORTCUT_QUICK_PICKS.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded border border-border/70 text-muted hover:text-foreground"
                onClick={() => setShortcutDraft(s)}
              >
                {shortcutDisplayLabel(s)}
              </button>
            ))}
          </div>
          {settings?.shortcut ? (
            <p className="text-[10px] text-muted">
              Aktywny: {shortcutDisplayLabel(settings.shortcut)}
            </p>
          ) : (
            <p className="text-[10px] text-muted">Brak skrótu — generuj z zaznaczenia w innych oknach.</p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-muted">Folder zapisu</p>
          <p className="text-[10px] text-muted truncate font-mono" title={settings?.outputDir}>
            {settings?.outputDir ?? "…"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border hover:border-accent/50"
              onClick={() =>
                void fastWorkNewOutputFolder()
                  .then(() => refresh())
                  .catch((e) => setError(String(e)))
              }
            >
              Nowy folder (timestamp)
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border hover:border-accent/50"
              onClick={() =>
                void fastWorkPickOutputFolder()
                  .then((p) => (p ? refresh() : undefined))
                  .catch((e) => setError(String(e)))
              }
            >
              Wybierz folder…
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border hover:border-accent/50"
              onClick={() =>
                void fastWorkOpenOutputFolder().catch((e) => setError(String(e)))
              }
            >
              Otwórz w eksploratorze
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-1 border-t border-border/60 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted shrink-0">
            Historia sesji ({history.length})
          </p>
          <ul className="flex-1 min-h-0 overflow-y-auto space-y-1 text-xs">
            {history.length === 0 ? (
              <li className="text-muted py-4 text-center">Brak generacji w tej sesji.</li>
            ) : (
              history.map((gen) => (
                <li
                  key={gen.id}
                  className="flex items-center gap-2 rounded border border-border/50 px-2 py-1.5 bg-panel/20"
                >
                  <button
                    type="button"
                    className="shrink-0 w-7 h-7 rounded border border-border text-[10px] disabled:opacity-40"
                    disabled={gen.status !== "done" || !gen.filePath}
                    onClick={() => handlePlay(gen)}
                    title="Odtwórz"
                  >
                    {playingId === gen.id ? "■" : "▶"}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{gen.title}</p>
                    <p className="text-[10px] text-muted truncate">
                      {gen.status === "running"
                        ? "Generowanie…"
                        : gen.status === "failed"
                          ? (gen.error ?? "Błąd")
                          : gen.format.toUpperCase()}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
