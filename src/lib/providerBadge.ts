import badgeGoogleUrl from "../assets/provider-badges/badge-google.png?url";
import badgeMinimaxUrl from "../assets/provider-badges/badge-minimax.png?url";
import badgeVoiceboxUrl from "../assets/provider-badges/badge-voicebox.png?url";
import type { TtsProvider } from "../types";

export interface ProviderBadgeMeta {
  /** Fallback when image fails to load */
  letter: string;
  title: string;
  iconUrl: string;
  /** Tailwind classes for badge container ring/background */
  className: string;
}

const BADGES: Record<TtsProvider, ProviderBadgeMeta> = {
  google: {
    letter: "G",
    title: "Google Gemini",
    iconUrl: badgeGoogleUrl,
    className: "bg-panel/95 ring-1 ring-border/80",
  },
  minimax: {
    letter: "M",
    title: "Minimax",
    iconUrl: badgeMinimaxUrl,
    className: "bg-panel/95 ring-1 ring-border/80",
  },
  voicebox: {
    letter: "V",
    title: "Voice Box",
    iconUrl: badgeVoiceboxUrl,
    className: "bg-panel/95 ring-1 ring-border/80",
  },
};

export function providerBadgeMeta(provider: string): ProviderBadgeMeta {
  const key = provider as TtsProvider;
  return BADGES[key] ?? BADGES.google;
}
