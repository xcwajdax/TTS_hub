import {
  normalizeTimelineViewMode,
  parseTimelineViewMode,
  type TimelineViewMode,
} from "../lib/timelineView";
import type { SkinManifest } from "./types";

export interface SkinPreferences {
  timeline_view?: TimelineViewMode;
}

export function getSkinTimelineViewPreference(
  manifest: Pick<SkinManifest, "preferences">,
): TimelineViewMode | null {
  const raw = manifest.preferences?.timeline_view;
  return parseTimelineViewMode(raw);
}

export function parseSkinPreferences(raw: unknown): SkinPreferences | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const timeline = parseTimelineViewMode(m.timeline_view);
  if (!timeline) return undefined;
  return { timeline_view: timeline };
}

export function normalizeSkinPreferences(raw: unknown): SkinPreferences | undefined {
  const parsed = parseSkinPreferences(raw);
  if (!parsed?.timeline_view) return undefined;
  return { timeline_view: normalizeTimelineViewMode(parsed.timeline_view) };
}
