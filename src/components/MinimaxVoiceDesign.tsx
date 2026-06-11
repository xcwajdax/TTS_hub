import { useState } from "react";
import { minimaxDesignVoice, type MinimaxClonedVoice } from "../api/tauri";

interface Props {
  onDesigned: (voice: MinimaxClonedVoice) => void;
  onError: (message: string) => void;
}

export default function MinimaxVoiceDesign({ onDesigned, onError }: Props) {
  const [prompt, setPrompt] = useState(
    "Spokojny polski narrator dokumentalny, ciepły bariton, naturalne tempo.",
  );
  const [previewText, setPreviewText] = useState(
    "To jest podgląd głosu zaprojektowanego przez MiniMax Voice Design.",
  );
  const [voiceId, setVoiceId] = useState("");
  const [busy, setBusy] = useState(false);

  const onDesign = async () => {
    if (!prompt.trim() || !previewText.trim() || busy) return;
    setBusy(true);
    try {
      const result = await minimaxDesignVoice({
        prompt: prompt.trim(),
        previewText: previewText.trim(),
        voiceId: voiceId.trim() || null,
      });
      onDesigned({
        voice_id: result.voice_id,
        name: `Design: ${prompt.trim().slice(0, 40)}`,
        created_at: Math.floor(Date.now() / 1000),
        output_vol: null,
      });
      setVoiceId("");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-[10px] text-muted">
        Voice Design tworzy nowy voice_id z opisu tekstowego. Podgląd jest płatny według cennika
        MiniMax.
      </p>
      <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
        Opis głosu (prompt)
        <textarea className="field min-h-[72px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
        Tekst podglądu (max 500 znaków)
        <textarea
          className="field min-h-[56px]"
          value={previewText}
          maxLength={500}
          onChange={(e) => setPreviewText(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
        voice_id (opcjonalny, 8–256 znaków)
        <input
          className="field"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="np. my_designed_voice"
        />
      </label>
      <div className="col-span-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy || !prompt.trim() || !previewText.trim()}
          onClick={() => void onDesign()}
        >
          {busy ? "Projektuję…" : "Zaprojektuj głos"}
        </button>
      </div>
    </div>
  );
}
