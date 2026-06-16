import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  voiceboxAddProfileSample,
  voiceboxDeleteProfileSample,
  voiceboxFetchSampleAudio,
  voiceboxListProfileSamples,
  type VoiceBoxSample,
} from "../../api/tauri";
import { voiceboxPayloadToObjectUrl } from "../../lib/voiceboxAudio";

interface Props {
  profileId: string;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onChanged?: () => void;
}

export default function VoiceboxSamplesPanel({
  profileId,
  onError,
  onSuccess,
  onChanged,
}: Props) {
  const [samples, setSamples] = useState<VoiceBoxSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [referenceText, setReferenceText] = useState("");
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const load = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      setSamples(await voiceboxListProfileSamples(profileId));
    } catch (e) {
      onError(String(e));
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      audioRef.current?.pause();
    };
  }, [profileId]);

  const pickAndUpload = async () => {
    if (!referenceText.trim()) {
      onError("Podaj tekst referencyjny próbki (reference_text).");
      return;
    }
    const picked = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "ogg"] }],
    });
    if (!picked || Array.isArray(picked)) return;
    setBusy(true);
    try {
      await voiceboxAddProfileSample(profileId, picked, referenceText.trim());
      setReferenceText("");
      await load();
      onChanged?.();
      onSuccess?.("Dodano próbkę głosu.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const playSample = async (sampleId: string) => {
    try {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current?.pause();
      const payload = await voiceboxFetchSampleAudio(sampleId);
      const url = voiceboxPayloadToObjectUrl(payload);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(sampleId);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        setPlayingId(null);
        onError("Nie udało się odtworzyć próbki.");
      };
      await audio.play();
    } catch (e) {
      onError(String(e));
    }
  };

  const removeSample = async (sampleId: string) => {
    if (!window.confirm("Usunąć tę próbkę z profilu Voice Box?")) return;
    try {
      await voiceboxDeleteProfileSample(sampleId);
      await load();
      onChanged?.();
      onSuccess?.("Usunięto próbkę.");
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] text-muted">
        Próbki referencyjne używane do klonowania głosu. Każda wymaga pliku audio i dokładnego
        tekstu wypowiedzi (reference_text).
      </p>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Tekst referencyjny nowej próbki
        <textarea
          className="field min-h-[4rem] text-sm"
          value={referenceText}
          onChange={(e) => setReferenceText(e.target.value)}
          placeholder="Dokładna transkrypcja nagrania…"
        />
      </label>
      <button
        type="button"
        className="btn text-xs self-start"
        disabled={busy || !profileId}
        onClick={() => void pickAndUpload()}
      >
        {busy ? "Wgrywam…" : "Dodaj próbkę z pliku…"}
      </button>
      {loading ? (
        <p className="text-xs text-muted">Ładowanie próbek…</p>
      ) : samples.length === 0 ? (
        <p className="text-xs text-muted">Brak próbek — dodaj co najmniej jedną do klonowania.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {samples.map((s) => (
            <li
              key={s.id}
              className="border border-border rounded-md p-2.5 flex flex-col gap-2 bg-panel2/20"
            >
              <p className="text-xs text-heading line-clamp-3">{s.reference_text}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => void playSample(s.id)}
                  disabled={playingId === s.id}
                >
                  {playingId === s.id ? "Odtwarzam…" : "Odtwórz"}
                </button>
                <button
                  type="button"
                  className="btn text-xs text-red-300"
                  onClick={() => void removeSample(s.id)}
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
