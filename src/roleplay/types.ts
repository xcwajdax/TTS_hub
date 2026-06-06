import type { TtsVoiceProfile } from "../appSettings";

export type RoleplayPhase = "script" | "summary" | "studio";

export interface PaletteEntry {
  color: string;
  voiceProfileId: string;
}

export interface RoleplaySegment {
  id: string;
  order_index: number;
  text: string;
  voice_profile_id: string;
  color: string;
  generation_id?: string | null;
  status: string;
  retry_count?: number;
  error?: string | null;
}

export interface RoleplayProjectSummary {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  status: string;
  segment_count: number;
}

export interface RoleplayProject {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  doc_json: string;
  palette_json: string;
  timeline_json: string;
  status: string;
  segments: RoleplaySegment[];
}

export interface SaveRoleplayProjectReq {
  id: string;
  name: string;
  doc_json: string;
  palette_json: string;
  timeline_json: string;
  status: string;
  segments: Array<{
    id: string;
    order_index: number;
    text: string;
    voice_profile_id: string;
    color: string;
  }>;
}

export interface RoleplayQueueProgress {
  project_id: string;
  total: number;
  done: number;
  current_segment_id: string | null;
  paused: boolean;
}

export type TrackEffectType = "eq" | "reverb" | "compressor";

export interface TrackEffect {
  type: TrackEffectType;
  enabled: boolean;
  params: Record<string, number>;
}

export interface TimelineTrack {
  id: string;
  name: string;
  voiceProfileId?: string;
  gainDb: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffect[];
}

export interface GainEnvelopePoint {
  t: number;
  gainDb: number;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  segmentId?: string;
  sourcePath: string;
  generationId?: string;
  startSec: number;
  offsetSec: number;
  durationSec: number;
  gainDb: number;
  fadeInSec: number;
  fadeOutSec: number;
  gainEnvelope: GainEnvelopePoint[];
}

export interface RoleplayTimeline {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
}

export const DEFAULT_TIMELINE: RoleplayTimeline = { tracks: [], clips: [] };

export const ROLEPLAY_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#94a3b8",
] as const;

export function parsePalette(json: string): PaletteEntry[] {
  try {
    const v = JSON.parse(json) as PaletteEntry[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Backend (Rust) serializes timeline fields in snake_case; normalize for the UI. */
export function normalizeTimeline(raw: unknown): RoleplayTimeline {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TIMELINE };
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.tracks) || !Array.isArray(o.clips)) return { ...DEFAULT_TIMELINE };

  const tracks = (o.tracks as Record<string, unknown>[]).map((t) => ({
    id: String(t.id ?? ""),
    name: String(t.name ?? "Ścieżka"),
    voiceProfileId:
      (t.voiceProfileId as string | undefined) ?? (t.voice_profile_id as string | undefined),
    gainDb: Number(t.gainDb ?? t.gain_db ?? 0),
    muted: Boolean(t.muted),
    solo: Boolean(t.solo),
    effects: (Array.isArray(t.effects) ? t.effects : []) as TrackEffect[],
  }));

  const clips = (o.clips as Record<string, unknown>[]).map((c) => ({
    id: String(c.id ?? crypto.randomUUID()),
    trackId: String(c.trackId ?? c.track_id ?? ""),
    segmentId: (c.segmentId ?? c.segment_id) as string | undefined,
    sourcePath: String(c.sourcePath ?? c.source_path ?? ""),
    generationId: (c.generationId ?? c.generation_id) as string | undefined,
    startSec: Number(c.startSec ?? c.start_sec ?? 0),
    offsetSec: Number(c.offsetSec ?? c.offset_sec ?? 0),
    durationSec: Math.max(0.1, Number(c.durationSec ?? c.duration_sec ?? 1)),
    gainDb: Number(c.gainDb ?? c.gain_db ?? 0),
    fadeInSec: Number(c.fadeInSec ?? c.fade_in_sec ?? 0),
    fadeOutSec: Number(c.fadeOutSec ?? c.fade_out_sec ?? 0),
    gainEnvelope: (Array.isArray(c.gain_envelope)
      ? c.gain_envelope
      : Array.isArray(c.gainEnvelope)
        ? c.gainEnvelope
        : []) as GainEnvelopePoint[],
  }));

  return { tracks, clips };
}

export function parseTimeline(json: string): RoleplayTimeline {
  try {
    return normalizeTimeline(JSON.parse(json));
  } catch {
    return { ...DEFAULT_TIMELINE };
  }
}

export function timelineToJson(timeline: RoleplayTimeline): string {
  return JSON.stringify({
    tracks: timeline.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      voice_profile_id: t.voiceProfileId ?? null,
      gain_db: t.gainDb,
      muted: t.muted,
      solo: t.solo,
      effects: t.effects,
    })),
    clips: timeline.clips.map((c) => ({
      id: c.id,
      track_id: c.trackId,
      segment_id: c.segmentId ?? null,
      source_path: c.sourcePath,
      generation_id: c.generationId ?? null,
      start_sec: c.startSec,
      offset_sec: c.offsetSec,
      duration_sec: c.durationSec,
      gain_db: c.gainDb,
      fade_in_sec: c.fadeInSec,
      fade_out_sec: c.fadeOutSec,
      gain_envelope: c.gainEnvelope,
    })),
  });
}

export function labelTracks(
  timeline: RoleplayTimeline,
  profiles: TtsVoiceProfile[],
): RoleplayTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => {
      const pid = t.voiceProfileId ?? t.id.replace(/^track-/, "");
      return {
        ...t,
        voiceProfileId: pid || t.voiceProfileId,
        name: pid ? profileLabel(profiles, pid) : t.name,
      };
    }),
  };
}

export function profileLabel(profiles: TtsVoiceProfile[], id: string): string {
  return profiles.find((p) => p.id === id)?.name ?? id.slice(0, 8);
}
