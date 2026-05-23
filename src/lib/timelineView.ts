/** Main playback bar waveform / timeline visualization mode. */

export type TimelineViewMode = "bars" | "bars-detailed" | "line";

export const TIMELINE_VIEW_MODES: TimelineViewMode[] = ["bars", "bars-detailed", "line"];

export const DEFAULT_TIMELINE_VIEW: TimelineViewMode = "bars";

export const TIMELINE_VIEW_LABELS: Record<TimelineViewMode, string> = {
  bars: "Słupki",
  "bars-detailed": "Słupki szczegółowe",
  line: "Fala (linia)",
};

export const TIMELINE_VIEW_DESCRIPTIONS: Record<TimelineViewMode, string> = {
  bars: "Klasyczne słupki amplitudy — domyślny widok.",
  "bars-detailed": "Więcej, cieńszych słupków dla dokładniejszego podglądu.",
  line: "Ciągła linia fali dźwiękowej bez słupków.",
};

/** Peak bar count for waveform decoding per mode. */
export function timelineViewBarCount(mode: TimelineViewMode): number {
  switch (mode) {
    case "bars-detailed":
      return 280;
    case "line":
      return 512;
    default:
      return 120;
  }
}

export function parseTimelineViewMode(raw: unknown): TimelineViewMode | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase() as TimelineViewMode;
  return TIMELINE_VIEW_MODES.includes(v) ? v : null;
}

export function normalizeTimelineViewMode(raw: unknown): TimelineViewMode {
  return parseTimelineViewMode(raw) ?? DEFAULT_TIMELINE_VIEW;
}
