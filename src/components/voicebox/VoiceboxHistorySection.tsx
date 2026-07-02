import { useCallback, useEffect, useRef, useState } from "react";
import {
  voiceboxDeleteHistoryItem,
  voiceboxFetchHistoryAudio,
  voiceboxListHistory,
  type VoiceBoxHistoryItem,
  type VoiceBoxProfile,
} from "../../api/tauri";
import { getMockVoiceboxHistory } from "../../lib/mockUi";
import { isMockUiMode } from "../../lib/mockUi/isMockUiMode";
import { voiceboxPayloadToObjectUrl } from "../../lib/voiceboxAudio";

const PAGE_SIZE = 30;

interface Props {
  profiles: VoiceBoxProfile[];
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pl-PL");
  } catch {
    return iso;
  }
}

export default function VoiceboxHistorySection({ profiles, onError, onSuccess }: Props) {
  const [items, setItems] = useState<VoiceBoxHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [profileFilter, setProfileFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    if (isMockUiMode()) {
      const res = getMockVoiceboxHistory();
      setItems(res.items);
      setTotal(res.total);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await voiceboxListHistory({
        profile_id: profileFilter || null,
        search: search.trim() || null,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      onError(String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [profileFilter, search, offset, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      audioRef.current?.pause();
    },
    [],
  );

  const playItem = async (id: string) => {
    if (isMockUiMode()) {
      onError("Tryb mockup — odtwarzanie historii Voice Box jest wyłączone.");
      return;
    }
    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current?.pause();
      const payload = await voiceboxFetchHistoryAudio(id);
      const url = voiceboxPayloadToObjectUrl(payload);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      await audio.play();
    } catch (e) {
      onError(String(e));
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("Usunąć ten wpis z historii Voice Box?")) return;
    try {
      await voiceboxDeleteHistoryItem(id);
      await load();
      onSuccess?.("Usunięto wpis z historii Voice Box.");
    } catch (e) {
      onError(String(e));
    }
  };

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] text-muted">
        Historia generacji przechowywana na serwerze Voice Box (osobna od lokalnej historii TTS
        Hub).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1 text-muted">
          Filtr profilu
          <select
            className="field"
            value={profileFilter}
            onChange={(e) => {
              setOffset(0);
              setProfileFilter(e.target.value);
            }}
          >
            <option value="">Wszystkie profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted">
          Szukaj w tekście
          <input
            className="field"
            value={search}
            onChange={(e) => {
              setOffset(0);
              setSearch(e.target.value);
            }}
            placeholder="Fragment tekstu…"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          {total} wpisów · strona {Math.floor(offset / PAGE_SIZE) + 1}
        </span>
        <button
          type="button"
          className="btn text-xs"
          disabled={!canPrev || loading}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
        >
          ← Poprzednia
        </button>
        <button
          type="button"
          className="btn text-xs"
          disabled={!canNext || loading}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          Następna →
        </button>
        <button type="button" className="btn text-xs" disabled={loading} onClick={() => void load()}>
          Odśwież
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Ładowanie historii…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">Brak wpisów dla wybranych filtrów.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border border-border rounded-md p-3 flex flex-col gap-2 bg-panel2/20 text-xs"
            >
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                <span>{item.profile_name ?? item.profile_id}</span>
                <span>{item.engine ?? "—"}</span>
                <span>{item.status}</span>
                {item.duration != null ? <span>{item.duration.toFixed(1)} s</span> : null}
                <span>{formatWhen(item.created_at)}</span>
              </div>
              <p className="text-sm text-heading line-clamp-3">{item.text}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={playingId === item.id}
                  onClick={() => void playItem(item.id)}
                >
                  {playingId === item.id ? "Odtwarzam…" : "Odtwórz"}
                </button>
                <button
                  type="button"
                  className="btn text-xs text-red-300"
                  onClick={() => void removeItem(item.id)}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
