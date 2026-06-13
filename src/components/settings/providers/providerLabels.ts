import type { TtsProviderId } from "../../../appSettings";

export const PROVIDER_LABELS: Record<TtsProviderId, { title: string; desc: string }> = {
  google: {
    title: "Google Gemini",
    desc: "Chmura — modele Gemini TTS, klucz API",
  },
  voicebox: {
    title: "Voice Box",
    desc: "Lokalny serwer HTTP — profile głosu",
  },
  minimax: {
    title: "MiniMax Portal",
    desc: "Chmura — WebSocket TTS, klucz API",
  },
};
