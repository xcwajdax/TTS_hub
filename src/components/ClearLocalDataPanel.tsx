import { useEffect, useState } from "react";
import {
  clearLocalAppData,
  getClearLocalDataConfirmationWord,
} from "../api/tauri";
import { formatBytes } from "../lib/formatBytes";

interface Props {
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onCleared?: () => void;
}

export default function ClearLocalDataPanel({ onError, onSuccess, onCleared }: Props) {
  const [confirmationWord, setConfirmationWord] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    getClearLocalDataConfirmationWord()
      .then(setConfirmationWord)
      .catch((e) => onError(String(e)));
  }, [onError]);

  const wordReady = confirmationWord !== null && confirmationWord.length > 0;
  const matches =
    wordReady &&
    typed.trim().toLowerCase() === confirmationWord.trim().toLowerCase();

  const runClear = async () => {
    if (!wordReady || !matches || clearing) return;
    setClearing(true);
    try {
      const result = await clearLocalAppData(typed.trim());
      setTyped("");
      setArmed(false);
      onCleared?.();
      onSuccess?.(
        `Usunięto ${result.removedGenerations} wpisów i ok. ${formatBytes(result.bytesRemoved)} plików lokalnych. Ustawienia pozostały bez zmian.`,
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 border border-red-500/30 rounded-md p-3 bg-red-950/20">
      <h3 className="text-xs uppercase tracking-wide text-red-300/90">Pamięć lokalna</h3>
      <p className="text-[11px] text-muted">
        Usuwa całą historię generacji, archiwum audio, sesje czatu, projekty roleplay, soundboard,
        próbki głosów, własne skórki i cache — zwalnia miejsce na dysku. Plik ustawień (klucze API,
        ścieżki, preferencje) pozostaje.
      </p>
      {!armed ? (
        <button
          type="button"
          className="btn text-xs self-start border-red-500/40 text-red-300/90 hover:bg-red-950/35"
          onClick={() => setArmed(true)}
        >
          Wyczyść pliki lokalne…
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-muted">
            Aby potwierdzić, wpisz nazwę tego komputera
            {wordReady ? (
              <>
                {" "}
                (<span className="text-heading font-medium">{confirmationWord}</span>)
              </>
            ) : (
              " (ładowanie…)"
            )}
            . Operacji nie można cofnąć.
          </p>
          <input
            className="field max-w-sm"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && !clearing) {
                e.preventDefault();
                void runClear();
              }
            }}
            placeholder={confirmationWord ?? "nazwa komputera"}
            autoComplete="off"
            spellCheck={false}
            disabled={clearing || !wordReady}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-xs border-red-500/40 text-red-300/90 hover:bg-red-950/35 disabled:opacity-50"
              disabled={!matches || clearing}
              onClick={() => void runClear()}
            >
              {clearing ? "Usuwanie…" : "Usuń wszystkie pliki lokalne"}
            </button>
            <button
              type="button"
              className="btn text-xs"
              disabled={clearing}
              onClick={() => {
                setArmed(false);
                setTyped("");
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
