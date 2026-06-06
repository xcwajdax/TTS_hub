import type { TimelineTrack, TrackEffect, TrackEffectType } from "../types";

interface Props {
  track: TimelineTrack;
  onChange: (track: TimelineTrack) => void;
}

const DEFAULT_EFFECTS: Record<TrackEffectType, TrackEffect> = {
  eq: {
    type: "eq",
    enabled: true,
    params: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 4000, midQ: 1 },
  },
  reverb: { type: "reverb", enabled: false, params: { mix: 0.2 } },
  compressor: {
    type: "compressor",
    enabled: false,
    params: { threshold: -24, ratio: 3, attackMs: 10, releaseMs: 120 },
  },
};

export default function EffectsPanel({ track, onChange }: Props) {
  const toggle = (type: TrackEffectType) => {
    const existing = track.effects.find((e) => e.type === type);
    const nextEffects = existing
      ? track.effects.map((e) => (e.type === type ? { ...e, enabled: !e.enabled } : e))
      : [...track.effects, { ...DEFAULT_EFFECTS[type] }];
    onChange({ ...track, effects: nextEffects });
  };

  return (
    <div className="text-xs space-y-2">
      <div className="font-medium text-heading text-sm">Efekty ścieżki</div>
      {(["eq", "compressor", "reverb"] as TrackEffectType[]).map((type) => {
        const fx = track.effects.find((e) => e.type === type);
        return (
          <label key={type} className="flex items-center gap-2">
            <input type="checkbox" checked={fx?.enabled ?? false} onChange={() => toggle(type)} />
            {type}
          </label>
        );
      })}
    </div>
  );
}
