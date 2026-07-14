import type { TtsVoiceProfile } from "../../appSettings";
import type { TimelineTrack } from "../types";
import VoiceProfileAvatar from "../VoiceProfileAvatar";

interface Props {
  track: TimelineTrack;
  profile?: TtsVoiceProfile | null;
  color?: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (track: TimelineTrack) => void;
}

export default function TrackHeader({ track, profile, color, selected, onSelect, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left border-b border-border px-2 py-2 flex flex-col gap-1.5 transition-colors ${
        selected ? "bg-panel2 ring-1 ring-inset ring-accent" : "hover:bg-panel2/60"
      }`}
      style={color ? { borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" } : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        {profile ? (
          <VoiceProfileAvatar profile={profile} size={36} className="shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-panel2 border border-border shrink-0" />
        )}
        <div className="text-xs font-medium text-heading truncate min-w-0" title={track.name}>
          {track.name}
        </div>
      </div>
      <label
        className="text-[10px] text-muted flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={track.muted}
          onChange={(e) => onChange({ ...track, muted: e.target.checked })}
        />
        Wycisz
      </label>
      <label className="text-[10px] text-muted flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={track.solo}
          onChange={(e) => onChange({ ...track, solo: e.target.checked })}
        />
        Solo
      </label>
      <input
        type="range"
        min={-24}
        max={12}
        step={0.5}
        value={track.gainDb}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ ...track, gainDb: Number(e.target.value) })}
        className="w-full h-1"
        title="Głośność ścieżki (dB)"
      />
    </button>
  );
}
