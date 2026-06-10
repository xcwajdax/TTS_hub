import type { TtsVoiceProfile } from "../appSettings";
import type { RoleplaySegment } from "./types";
import { profileLabel } from "./types";

export interface SegmentStatsRow {
  voice_profile_id: string;
  label: string;
  provider: string;
  segments: number;
  chars: number;
}

export interface RoleplayGenerationStats {
  totalSegments: number;
  totalChars: number;
  byVoice: SegmentStatsRow[];
  estimatedAudioSec: number;
  estimatedGenSec: number;
  warnings: string[];
}

const CHARS_PER_SEC_SPEECH = 14;
const MS_PER_CHAR_HEURISTIC = 45;

export function computeGenerationStats(
  segments: RoleplaySegment[],
  profiles: TtsVoiceProfile[],
): RoleplayGenerationStats {
  const warnings: string[] = [];
  const byId = new Map<string, SegmentStatsRow>();

  for (const seg of segments) {
    const profile = profiles.find((p) => p.id === seg.voice_profile_id);
    if (!profile) {
      warnings.push(`Brak profilu dla segmentu: ${seg.text.slice(0, 40)}…`);
      continue;
    }
    if (!profile.voice?.trim()) {
      warnings.push(`Profil „${profile.name}” nie ma przypisanego głosu.`);
    }
    const row = byId.get(seg.voice_profile_id) ?? {
      voice_profile_id: seg.voice_profile_id,
      label: profileLabel(profiles, seg.voice_profile_id),
      provider: profile.provider,
      segments: 0,
      chars: 0,
    };
    row.segments += 1;
    row.chars += seg.text.length;
    byId.set(seg.voice_profile_id, row);
  }

  const byVoice = [...byId.values()].sort((a, b) => b.chars - a.chars);
  const totalChars = segments.reduce((n, s) => n + s.text.length, 0);
  const providers = new Set(byVoice.map((r) => r.provider));
  if (providers.size > 1) {
    warnings.push(`Mieszani providerzy: ${[...providers].join(", ")}.`);
  }
  if (segments.length === 0) {
    warnings.push("Brak segmentów do generacji — zaznacz tekst mazakami.");
  }

  const estimatedAudioSec = Math.ceil(totalChars / CHARS_PER_SEC_SPEECH);
  const estimatedGenSec = Math.ceil((totalChars * MS_PER_CHAR_HEURISTIC) / 1000);

  return {
    totalSegments: segments.length,
    totalChars,
    byVoice,
    estimatedAudioSec,
    estimatedGenSec,
    warnings,
  };
}
