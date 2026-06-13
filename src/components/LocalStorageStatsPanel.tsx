import { useCallback, useEffect, useState } from "react";
import { getLocalStorageStats, type LocalStorageStats } from "../api/tauri";
import { formatBytes } from "../lib/formatBytes";

interface Props {
  onError: (message: string) => void;
  refreshKey?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  temp: "Sesja / temp",
  archive: "Archiwum audio",
  voice_samples: "Próbki głosów",
  avatars: "Awatary",
  skins: "Skórki",
  skin_registry_cache: "Cache rejestru skórek",
  soundboard: "Soundboard",
  roleplay: "Projekty roleplay",
  temp_legacy: "Temp (domyślna ścieżka)",
  archive_legacy: "Archiwum (domyślna ścieżka)",
};

function labelForCategory(id: string): string {
  return CATEGORY_LABELS[id] ?? id;
}

export default function LocalStorageStatsPanel({ onError, refreshKey = 0 }: Props) {
  const [stats, setStats] = useState<LocalStorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getLocalStorageStats());
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !stats) {
    return (
      <section className="flex flex-col gap-2 border border-border rounded-md p-3 bg-panel2/30">
        <h3 className="text-xs uppercase tracking-wide text-muted">Wykorzystanie miejsca</h3>
        <p className="text-[11px] text-muted">Ładowanie statystyk…</p>
      </section>
    );
  }

  if (!stats) return null;

  const fileCategories = stats.categories.filter((c) => c.bytes > 0 || c.fileCount > 0);

  return (
    <section className="flex flex-col gap-3 border border-border rounded-md p-3 bg-panel2/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-muted">Wykorzystanie miejsca</h3>
          <p className="text-lg font-semibold mt-1">{formatBytes(stats.totalBytes)}</p>
          <p className="text-[11px] text-muted break-all">Katalog danych: {stats.rootPath}</p>
        </div>
        <button type="button" className="btn text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? "Odświeżanie…" : "Odśwież"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="rounded border border-border/60 px-2 py-1.5 bg-panel/40">
          <div className="text-muted">Generacje</div>
          <div className="font-medium">{stats.generationCount}</div>
        </div>
        <div className="rounded border border-border/60 px-2 py-1.5 bg-panel/40">
          <div className="text-muted">Sesje czatu</div>
          <div className="font-medium">{stats.chatSessionCount}</div>
        </div>
        <div className="rounded border border-border/60 px-2 py-1.5 bg-panel/40">
          <div className="text-muted">Roleplay</div>
          <div className="font-medium">{stats.roleplayProjectCount}</div>
        </div>
        <div className="rounded border border-border/60 px-2 py-1.5 bg-panel/40">
          <div className="text-muted">Baza SQLite</div>
          <div className="font-medium">{formatBytes(stats.dbBytes)}</div>
        </div>
      </div>

      {fileCategories.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-border/60">
                <th className="py-1.5 pr-3 font-normal">Kategoria</th>
                <th className="py-1.5 pr-3 font-normal text-right">Pliki</th>
                <th className="py-1.5 font-normal text-right">Rozmiar</th>
              </tr>
            </thead>
            <tbody>
              {fileCategories.map((cat) => (
                <tr key={cat.id} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-3">{labelForCategory(cat.id)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{cat.fileCount}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatBytes(cat.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[11px] text-muted">Brak plików w katalogach aplikacji (poza ustawieniami).</p>
      )}

      <p className="text-[10px] text-muted">
        Plik ustawień: {formatBytes(stats.settingsBytes)} — nie jest usuwany przy czyszczeniu.
      </p>
    </section>
  );
}
