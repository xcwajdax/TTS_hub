import type { Generation, GenerationSource } from "../types";
import type { IconSlug } from "./icons";

export interface SourceUiConfig {
  label: string;
  defaultColor: string;
  icon: IconSlug;
}

/** Default accent colors per generation source (history metadata bar). */
export const SOURCE_UI: Record<GenerationSource, SourceUiConfig> = {
  manual: {
    label: "Ręczne",
    defaultColor: "#7c8fd4",
    icon: "source-manual",
  },
  http: {
    label: "HTTP",
    defaultColor: "#a855f7",
    icon: "source-http",
  },
  cursor: {
    label: "Cursor",
    defaultColor: "#22c55e",
    icon: "source-cursor",
  },
  "cursor-skill": {
    label: "Cursor Skill",
    defaultColor: "#2dd4bf",
    icon: "source-cursor-skill",
  },
  quick_hotkey: {
    label: "Skrót",
    defaultColor: "#f97316",
    icon: "source-quick-hotkey",
  },
};

export const HISTORY_COLOR_PRESETS = [
  "#7c8fd4",
  "#a855f7",
  "#22c55e",
  "#2dd4bf",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#3b82f6",
] as const;

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.length === 6 ? h : "64748b";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Active source-filter chip — border, fill, and glow from source accent. */
export function historySourceToolbarActiveStyle(accent: string): Record<string, string> {
  return {
    borderColor: hexToRgba(accent, 0.92),
    background: hexToRgba(accent, 0.32),
    color: accent,
    boxShadow: `inset 0 0 0 1px ${hexToRgba(accent, 0.45)}, 0 0 12px ${hexToRgba(accent, 0.22)}`,
  };
}

/** Inactive source-filter chip — subtle bottom accent so sources stay distinguishable. */
export function historySourceToolbarIdleStyle(accent: string): Record<string, string> {
  return {
    boxShadow: `inset 0 -2px 0 ${hexToRgba(accent, 0.72)}`,
  };
}

export function getSourceUi(source: GenerationSource): SourceUiConfig {
  return SOURCE_UI[source] ?? SOURCE_UI.manual;
}

export function sourceFilterAccent(id: GenerationSource | "all"): string | undefined {
  if (id === "all") return undefined;
  return getSourceUi(id).defaultColor;
}

export function resolveHistoryItemColor(gen: Generation): string {
  const manual = gen.ui_color?.trim();
  if (manual) return manual;
  return getSourceUi(gen.source).defaultColor;
}

/** Card surface for history rows — accent tint + elevation on panel background. */
export function historyItemSurfaceStyle(
  accentColor: string,
  isCurrent: boolean,
): Record<string, string | number> {
  const base = {
    borderLeftWidth: 4,
    borderLeftColor: accentColor,
  };
  if (isCurrent) return base;
  return {
    ...base,
    backgroundColor: "rgb(var(--color-panel2))",
    backgroundImage: `linear-gradient(90deg, ${hexToRgba(accentColor, 0.22)} 0%, ${hexToRgba(accentColor, 0.08)} 2.75rem, transparent 4.75rem)`,
    boxShadow: `0 2px 6px rgb(0 0 0 / 0.38), 0 0 0 1px rgb(var(--color-border) / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.04)`,
  };
}

export function sourceLabelForGeneration(gen: Generation): string {
  return getSourceUi(gen.source).label;
}

/** Toolbar filter chips in history sidebar (includes "all"). */
export const SOURCE_FILTER_META: Record<
  GenerationSource | "all",
  { label: string; description: string; icon?: IconSlug }
> = {
  all: {
    label: "Wszystkie",
    description: "Bez filtra — każde źródło generacji",
    icon: "source-all",
  },
  manual: {
    ...SOURCE_UI.manual,
    description: "Tekst z głównego panelu lub ręczna generacja",
  },
  http: {
    ...SOURCE_UI.http,
    description: "Lokalne API HTTP (automatyzacje, skrypty)",
  },
  cursor: {
    ...SOURCE_UI.cursor,
    description: "Hook Cursor — podsumowania i odpowiedzi agenta",
  },
  "cursor-skill": {
    ...SOURCE_UI["cursor-skill"],
    label: "Skill",
    description: "Skill @tts-hub-speak i skrypt speak-summary",
  },
  quick_hotkey: {
    ...SOURCE_UI.quick_hotkey,
    label: "Skrót",
    description: "Szybka generacja ze zaznaczenia (hotkey)",
  },
};

export const SOURCE_FILTER_ORDER: (GenerationSource | "all")[] = [
  "all",
  "manual",
  "cursor",
  "cursor-skill",
  "quick_hotkey",
  "http",
];
