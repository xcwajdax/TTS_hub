import { useState } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import type { TtsVoiceProfile } from "../appSettings";
import { exportFastWorkPortable, pickFastWorkExportFolder } from "../api/tauri";
import { SHORTCUT_QUICK_PICKS, shortcutDisplayLabel } from "../lib/quickHotkeyPreset";

interface Props {
  profile: TtsVoiceProfile;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onError: (message: string) => void;
}

export default function FastWorkExportDialog({
  profile,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [shortcut, setShortcut] = useState(profile.shortcut ?? "Ctrl+Alt+F");
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const destParent = await pickFastWorkExportFolder();
      if (!destParent) {
        setBusy(false);
        return;
      }
      const result = await exportFastWorkPortable(
        profile.id,
        destParent,
        shortcut.trim() || null,
      );
      onSuccess?.(`Wygenerowano Fast Work w: ${result.destDir}`);
      await message(
        `Aplikacja portable została zapisana.\n\nFolder:\n${result.destDir}\n\nUruchom „TTS Hub Fast Work.exe” lub plik .bat.`,
        { title: "Fast Work — gotowe", kind: "info" },
      );
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fw-export-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-panel shadow-xl text-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 id="fw-export-title" className="font-semibold">
            Wygeneruj aplikację Fast Work
          </h2>
          <p className="text-xs text-muted mt-1 truncate" title={profile.name}>
            Profil: {profile.name}
          </p>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-900/50 rounded px-2 py-2 leading-relaxed">
            Klucz API MiniMax zostanie zapisany w pliku fast-work.json obok aplikacji portable.
            Udostępniaj ten folder tylko zaufanym osobom.
          </p>
          <div>
            <label className="text-[10px] uppercase text-muted" htmlFor="fw-export-shortcut">
              Skrót globalny (opcjonalnie)
            </label>
            <input
              id="fw-export-shortcut"
              type="text"
              className="mt-1 w-full rounded border border-border bg-panel2/40 px-2 py-1.5 text-xs font-mono"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {SHORTCUT_QUICK_PICKS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border/70 text-muted hover:text-foreground"
                  onClick={() => setShortcut(s)}
                  disabled={busy}
                >
                  {shortcutDisplayLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-border text-muted hover:text-foreground text-xs"
            onClick={onClose}
            disabled={busy}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-accent text-accent-foreground text-xs font-medium disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy}
          >
            {busy ? "Generuję…" : "Wybierz folder i generuj"}
          </button>
        </div>
      </div>
    </div>
  );
}
