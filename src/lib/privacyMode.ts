import type { Generation } from "../types";

export type PrivacyMode = "normal" | "private" | "incognito";

export const PRIVACY_MODE_CYCLE: PrivacyMode[] = ["normal", "private", "incognito"];

let currentPrivacyMode: PrivacyMode = "normal";

export function getPrivacyModeSnapshot(): PrivacyMode {
  return currentPrivacyMode;
}

export function setPrivacyModeSnapshot(mode: PrivacyMode): void {
  currentPrivacyMode = mode;
  document.documentElement.dataset.privacyMode = mode;
}

export function normalizePrivacyMode(raw: string | null | undefined): PrivacyMode {
  if (raw === "private" || raw === "incognito") return raw;
  if (raw === "safe" || raw === "off") return "normal";
  return "normal";
}

export function nextPrivacyMode(current: PrivacyMode): PrivacyMode {
  const idx = PRIVACY_MODE_CYCLE.indexOf(current);
  return PRIVACY_MODE_CYCLE[(idx + 1) % PRIVACY_MODE_CYCLE.length] ?? "normal";
}

export const PRIVACY_MODE_LABELS: Record<PrivacyMode, string> = {
  normal: "Domyślny",
  private: "Prywatny",
  incognito: "Incognito",
};

export function privacyModeTitle(mode: PrivacyMode): string {
  switch (mode) {
    case "private":
      return "Tryb prywatny — zapis z wyraźnym oznaczeniem, potwierdzenie przed schowkiem";
    case "incognito":
      return "Incognito — bez zapisu do historii, tylko odtwarzanie tu i teraz";
    default:
      return "Tryb domyślny — standardowy zapis w historii";
  }
}

export function needsPrivateShareConfirm(
  gen: Generation | null | undefined,
  mode: PrivacyMode = getPrivacyModeSnapshot(),
): boolean {
  if (!gen) return false;
  return Boolean(gen.is_private) || mode === "private";
}
