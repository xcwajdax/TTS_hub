import type { VoiceBoxPlModelStatus } from "../api/tauri";

export type VoiceboxPlModelCard = {
  model_name: string;
  title: string;
  blurb: string;
  sizeHint: string;
  recommended?: boolean;
  warn?: string;
  default_engine: "chatterbox" | "tada";
  tada_size?: "1B" | "3B";
};

export const VOICEBOX_PL_MODEL_CARDS: VoiceboxPlModelCard[] = [
  {
    model_name: "chatterbox-tts",
    title: "Chatterbox",
    blurb: "Klonowanie PL — zalecany start (~3.2 GB).",
    sizeHint: "~3.2 GB",
    recommended: true,
    default_engine: "chatterbox",
  },
  {
    model_name: "tada-1b",
    title: "TADA 1B",
    blurb: "Klonowanie PL, lżejszy wariant TADA (~4 GB).",
    sizeHint: "~4 GB",
    default_engine: "tada",
    tada_size: "1B",
  },
  {
    model_name: "tada-3b-ml",
    title: "TADA 3B Multilingual",
    blurb: "Klonowanie PL, większy model (~8 GB).",
    sizeHint: "~8 GB",
    warn: "Wymaga więcej VRAM / miejsca na dysku.",
    default_engine: "tada",
    tada_size: "3B",
  },
];

export function statusForCard(
  statuses: VoiceBoxPlModelStatus[],
  modelName: string,
): VoiceBoxPlModelStatus | undefined {
  return statuses.find((s) => s.model_name === modelName);
}

export function hubModelIdForEngine(
  engine: string,
  tadaSize?: "1B" | "3B" | null,
): string {
  if (engine === "tada") {
    return tadaSize === "3B" ? "voicebox:tada-3b-ml" : "voicebox:tada-1b";
  }
  return "voicebox:chatterbox";
}

/** Map Hub TTS model id → Voicebox engine key for `/generate`. */
export function engineFromHubModelId(modelId: string): string | null {
  if (!modelId.startsWith("voicebox:")) return null;
  const rest = modelId.slice("voicebox:".length);
  if (rest === "tada-1b" || rest === "tada-3b-ml" || rest === "tada-3b" || rest === "tada") {
    return "tada";
  }
  if (rest === "chatterbox" || rest === "chatterbox-tts") {
    return "chatterbox";
  }
  if (rest === "chatterbox_turbo" || rest === "qwen" || rest === "kokoro" || rest === "luxtts") {
    return null;
  }
  return rest || null;
}
