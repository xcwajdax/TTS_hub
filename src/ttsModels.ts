export interface TtsModelInfo {
  id: string;
  display_name: string;
}

/** Known models when the API list is unavailable (matches Rust fallback). */
export const FALLBACK_TTS_MODELS: TtsModelInfo[] = [
  { id: "gemini-3.1-flash-tts-preview", display_name: "Gemini 3.1 Flash TTS (Preview)" },
  { id: "gemini-2.5-flash-preview-tts", display_name: "Gemini 2.5 Flash Preview TTS" },
  { id: "gemini-2.5-pro-preview-tts", display_name: "Gemini 2.5 Pro Preview TTS" },
];

export const DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview";

export function formatModelLabel(modelId: string, models?: TtsModelInfo[]): string {
  const known = models?.find((m) => m.id === modelId);
  if (known) return known.display_name;
  const fallback = FALLBACK_TTS_MODELS.find((m) => m.id === modelId);
  if (fallback) return fallback.display_name;
  if (modelId.startsWith("voicebox:")) {
    const engine = modelId.slice("voicebox:".length).replace(/_/g, " ");
    return `Voice Box ${engine}`;
  }
  if (modelId.startsWith("minimax:")) {
    return `Minimax ${modelId.slice("minimax:".length)}`;
  }
  return modelId;
}
