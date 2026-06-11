import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { minimaxCloneVoice, type MinimaxClonedVoice } from "../api/tauri";
import { defaultMinimaxCloneOptions } from "../lib/minimaxOptions";
import { MINIMAX_LANGUAGE_CATALOG } from "../lib/minimaxLanguages";

interface Props {
  model: string;
  onCloned: (voice: MinimaxClonedVoice) => void;
  onError: (message: string) => void;
}

export default function MinimaxVoiceClone({ model, onCloned, onError }: Props) {
  const [voiceId, setVoiceId] = useState("");
  const [name, setName] = useState("");
  const [previewText, setPreviewText] = useState(
    "Ten głos brzmi naturalnie i przyjemnie w syntezie mowy.",
  );
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [promptPath, setPromptPath] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [busy, setBusy] = useState(false);
  const [needNoiseReduction, setNeedNoiseReduction] = useState(false);
  const [needVolumeNormalization, setNeedVolumeNormalization] = useState(false);
  const [cloneLanguage, setCloneLanguage] = useState("");

  const pickAudio = async (kind: "source" | "prompt") => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["mp3", "m4a", "wav"] }],
    });
    if (!picked || Array.isArray(picked)) return;
    if (kind === "source") setSourcePath(picked);
    else setPromptPath(picked);
  };

  const onClone = async () => {
    if (!sourcePath || !voiceId.trim() || busy) return;
    setBusy(true);
    try {
      const entry = await minimaxCloneVoice({
        sourcePath,
        voiceId: voiceId.trim(),
        name: name.trim() || voiceId.trim(),
        model: model.startsWith("minimax:") ? model : `minimax:${model}`,
        previewText: previewText.trim() || "Podgląd sklonowanego głosu.",
        promptPath,
        promptText: promptText.trim() || null,
        cloneOptions: {
          ...defaultMinimaxCloneOptions(),
          need_noise_reduction: needNoiseReduction,
          need_volume_normalization: needVolumeNormalization,
          language: cloneLanguage.trim() || null,
        },
      });
      onCloned(entry);
      setVoiceId("");
      setName("");
      setSourcePath(null);
      setPromptPath(null);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-[10px] text-muted">
        Klonowanie: plik źródłowy 10 s–5 min (mp3/m4a/wav), opcjonalny prompt &lt;8 s. Wymaga MINIMAX_API_KEY.
      </p>
      <label className="flex flex-col gap-1 text-xs text-muted">
        voice_id (własny)
        <input
          className="field"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="np. my_voice_pl"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Nazwa w UI
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Mój głos"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
        Tekst podglądu po klonowaniu
        <input
          className="field"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <span>Plik źródłowy</span>
        <div className="flex gap-2">
          <button type="button" className="btn text-xs" onClick={() => void pickAudio("source")}>
            Wybierz…
          </button>
          <span className="truncate text-[10px] text-muted/80 self-center" title={sourcePath ?? ""}>
            {sourcePath ? sourcePath.split(/[/\\]/).pop() : "brak"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted">
        <span>Prompt audio (opc.)</span>
        <div className="flex gap-2">
          <button type="button" className="btn text-xs" onClick={() => void pickAudio("prompt")}>
            Wybierz…
          </button>
          <span className="truncate text-[10px] text-muted/80 self-center" title={promptPath ?? ""}>
            {promptPath ? promptPath.split(/[/\\]/).pop() : "brak"}
          </span>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        language_boost (klon)
        <select className="field" value={cloneLanguage} onChange={(e) => setCloneLanguage(e.target.value)}>
          <option value="">— domyślny —</option>
          {MINIMAX_LANGUAGE_CATALOG.map((l) => (
            <option key={l.code} value={l.code}>
              {l.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={needNoiseReduction}
          onChange={(e) => setNeedNoiseReduction(e.target.checked)}
        />
        Redukcja szumu
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={needVolumeNormalization}
          onChange={(e) => setNeedVolumeNormalization(e.target.checked)}
        />
        Normalizacja głośności
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
        Tekst promptu (opc.)
        <input
          className="field"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Transkrypcja krótkiego promptu"
        />
      </label>
      <div className="col-span-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy || !sourcePath || !voiceId.trim()}
          onClick={() => void onClone()}
        >
          {busy ? "Klonowanie…" : "Klonuj głos"}
        </button>
      </div>
    </div>
  );
}
