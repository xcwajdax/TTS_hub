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

export const FALLBACK_VOICEBOX_MODELS: TtsModelInfo[] = [
  { id: "voicebox:chatterbox", display_name: "Chatterbox" },
  { id: "voicebox:tada-1b", display_name: "TADA 1B" },
  { id: "voicebox:tada-3b-ml", display_name: "TADA 3B" },
];

const VOICEBOX_SHORT_LABELS: Record<string, string> = {
  "voicebox:chatterbox": "Chatterbox",
  "voicebox:chatterbox-tts": "Chatterbox",
  "voicebox:tada-1b": "TADA 1B",
  "voicebox:tada-3b-ml": "TADA 3B",
  "voicebox:tada-3b": "TADA 3B",
  "voicebox:tada": "TADA",
};

/** Compact label for toolbars and profile lists (strips "Voice Box" / "(loaded)"). */
export function shortModelLabel(modelId: string, models?: TtsModelInfo[]): string {
  const mapped = VOICEBOX_SHORT_LABELS[modelId];
  if (mapped) return mapped;
  const fromList = models?.find((m) => m.id === modelId)?.display_name;
  if (fromList) {
    return fromList.replace(/^Voice Box\s+/i, "").replace(/\s*\(loaded\)\s*$/i, "").trim();
  }
  return formatModelLabel(modelId, models);
}

export function formatModelLabel(modelId: string, models?: TtsModelInfo[]): string {
  const known = models?.find((m) => m.id === modelId);
  if (known) return known.display_name;
  const fallback = FALLBACK_TTS_MODELS.find((m) => m.id === modelId);
  if (fallback) return fallback.display_name;
  const voiceboxShort = VOICEBOX_SHORT_LABELS[modelId];
  if (voiceboxShort) return voiceboxShort;
  if (modelId.startsWith("voicebox:")) {
    const engine = modelId.slice("voicebox:".length).replace(/_/g, " ");
    return `Voice Box ${engine}`;
  }
  if (modelId.startsWith("minimax:")) {
    return `Minimax ${modelId.slice("minimax:".length)}`;
  }
  return modelId;
}
