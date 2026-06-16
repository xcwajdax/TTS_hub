import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { VideoExportRecord } from "../../types/videoTemplate";
import {
  copyVideoExportToClipboard,
  deleteVideoExport,
  listVideoExports,
} from "../../lib/videoTemplates";
import { formatDurationMs } from "../../lib/formatTime";
import { MP4_CLIPBOARD_SUCCESS_TOAST } from "../../lib/mp4ExportProgress";
import Icon from "../Icon";

interface Props {
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoLibraryPanel({ onError, onToast }: Props) {
  const [exports, setExports] = useState<VideoExportRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listVideoExports(200, 0);
      setExports(list);
      if (list.length > 0 && !list.some((e) => e.id === selectedId)) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onError, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = exports.find((e) => e.id === selectedId) ?? null;

  const handleCopy = async (rec: VideoExportRecord) => {
    try {
      await copyVideoExportToClipboard(rec.id);
      onToast?.(MP4_CLIPBOARD_SUCCESS_TOAST);
    } catch (e) {
      onError(String(e));
    }
  };

  const handleDelete = async (rec: VideoExportRecord) => {
    if (!window.confirm(`Usunąć „${rec.title ?? rec.id}" z biblioteki?`)) return;
    try {
      await deleteVideoExport(rec.id);
      if (selectedId === rec.id) setSelectedId(null);
      await refresh();
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="video-library-panel flex flex-col flex-1 min-h-0 overflow-hidden">
      {loading && exports.length === 0 ? (
        <p className="p-4 text-sm text-muted">Ładowanie biblioteki wideo…</p>
      ) : exports.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center text-muted">
          <Icon name="clip-external" size={32} className="opacity-30 mb-3" />
          <p className="text-sm">Brak zarchiwizowanych MP4</p>
          <p className="text-xs mt-1 max-w-xs">
            Skopiuj MP4 do schowka z historii — plik trafi tutaj automatycznie (jeśli auto-zapis jest
            włączony w ustawieniach Wideo).
          </p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 overflow-y-auto p-3 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 content-start">
            {exports.map((rec) => (
              <button
                key={rec.id}
                type="button"
                className={[
                  "video-export-card text-left rounded-lg border overflow-hidden transition-shadow",
                  selectedId === rec.id
                    ? "border-accent ring-1 ring-accent/40"
                    : "border-border hover:border-accent/50",
                ].join(" ")}
                onClick={() => setSelectedId(rec.id)}
              >
                <div className="aspect-square bg-panel2 relative">
                  {rec.thumbPath ? (
                    <img
                      src={convertFileSrc(rec.thumbPath)}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted">
                      <Icon name="clip-external" size={24} />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={rec.title ?? undefined}>
                    {rec.title ?? "Bez tytułu"}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {rec.durationMs != null ? formatDurationMs(rec.durationMs) : "—"} ·{" "}
                    {formatBytes(rec.fileSizeBytes)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <aside className="w-[min(100%,320px)] shrink-0 border-l border-border flex flex-col p-4 gap-3 overflow-y-auto bg-panel2/20">
              <h3 className="font-semibold text-sm truncate" title={selected.title ?? undefined}>
                {selected.title ?? "Wideo MP4"}
              </h3>
              <video
                key={selected.id}
                src={convertFileSrc(selected.filePath)}
                controls
                className="w-full rounded border border-border bg-black"
              />
              <dl className="text-[11px] text-muted flex flex-col gap-1">
                <div>Szablon: {selected.templateId}</div>
                <div>Źródło: {selected.source}</div>
                <div>Rozmiar: {formatBytes(selected.fileSizeBytes)}</div>
              </dl>
              <div className="flex flex-col gap-2 mt-auto">
                <button type="button" className="btn text-xs" onClick={() => void handleCopy(selected)}>
                  Kopiuj do schowka
                </button>
                <button
                  type="button"
                  className="btn text-xs text-red-300 border-red-900/50"
                  onClick={() => void handleDelete(selected)}
                >
                  Usuń z biblioteki
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
