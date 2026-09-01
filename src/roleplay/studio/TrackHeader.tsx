import type { TtsVoiceProfile } from "../../appSettings";
import type { TimelineTrack } from "../types";
import VoiceProfileAvatar from "../VoiceProfileAvatar";
import RoleplayGainSlider from "./RoleplayGainSlider";

interface Props {
  track: TimelineTrack;
  profile?: TtsVoiceProfile | null;
  color?: string;
  selected: boolean;
  laneHeight: number;
  onSelect: () => void;
  onChange: (track: TimelineTrack) => void;
}

export default function TrackHeader({
  track,
  profile,
  color,
  selected,
  laneHeight,
  onSelect,
  onChange,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`roleplay-track-header w-full text-left border-b border-border px-2 flex flex-col justify-center gap-1 transition-colors overflow-hidden shrink-0 ${
        selected ? "bg-panel2 ring-1 ring-inset ring-accent" : "hover:bg-panel2/60"
      }`}
      style={{
        height: laneHeight,
        ...(color ? { borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" } : {}),
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {profile ? (
          <VoiceProfileAvatar profile={profile} size={28} className="shrink-0" />
        ) : (
          <div className="voice-avatar-frame w-7 h-7 bg-panel2 shrink-0" />
        )}
        <div className="text-[11px] font-medium text-heading truncate min-w-0 flex-1" title={track.name}>
          {track.name}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted" onClick={(e) => e.stopPropagation()}>
        <label className="inline-flex items-center gap-0.5 cursor-default">
          <input
            type="checkbox"
            checked={track.muted}
            onChange={(e) => onChange({ ...track, muted: e.target.checked })}
          />
          M
        </label>
        <label className="inline-flex items-center gap-0.5 cursor-default">
          <input
            type="checkbox"
            checked={track.solo}
            onChange={(e) => onChange({ ...track, solo: e.target.checked })}
          />
          S
        </label>
      </div>

      <RoleplayGainSlider
        value={track.gainDb}
        onChange={(gainDb) => onChange({ ...track, gainDb })}
      />
    </button>
  );
}
