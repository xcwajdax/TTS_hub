import { useState } from "react";
import { formatModelLabel } from "../../ttsModels";
import type { PlaybackToastViewModel, PlaybackVizFramePayload } from "../../lib/playbackToastContract";
import PlaybackToastIdentity from "./PlaybackToastIdentity";
import PlaybackToastPanel from "./PlaybackToastPanel";

const AVATAR_SIZE = 24;

interface Props {
  active: PlaybackToastViewModel;
  pinned: PlaybackToastViewModel[];
  frame: PlaybackVizFramePayload | null;
  onHide: () => void;
  onClose: () => void;
}

function PinnedCard({
  model,
  frame,
  expanded,
  onToggle,
}: {
  model: PlaybackToastViewModel;
  frame: PlaybackVizFramePayload | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const gen = model.generation;
  const progress =
    frame && frame.duration > 0 ? frame.currentTime / frame.duration : 0;

  return (
    <div className="rounded-md border border-border/50 bg-panel2/40 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-panel2/60"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <PlaybackToastIdentity
          profileName={model.profileName}
          voiceAvatarPath={model.voiceAvatarPath}
          provider={model.provider}
          source={model.source}
          size={AVATAR_SIZE}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium truncate">{model.title}</p>
          <div className="h-0.5 mt-0.5 rounded-full bg-panel2 overflow-hidden">
            <div className="h-full bg-accent2/50" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <span className="text-[9px] text-muted shrink-0">📌</span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 text-[10px] text-muted border-t border-border/30 pt-1">
          <p className="truncate">{formatModelLabel(gen.model)} · {gen.format.toUpperCase()}</p>
          {model.filterPresetName && <p className="truncate">Filtr: {model.filterPresetName}</p>}
        </div>
      )}
    </div>
  );
}

export default function PlaybackToastStack({ active, pinned, frame, onHide, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5 min-h-0 max-h-[calc(100vh-1rem)] overflow-y-auto">
      <PlaybackToastPanel model={active} frame={frame} onHide={onHide} onClose={onClose} />
      {pinned.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          <p className="text-[9px] uppercase tracking-wide text-muted px-1">
            Przypięte ({pinned.length})
          </p>
          {pinned.map((model) => (
            <PinnedCard
              key={model.generation.id}
              model={model}
              frame={model.generation.id === active.generation.id ? frame : null}
              expanded={expandedId === model.generation.id}
              onToggle={() =>
                setExpandedId((id) => (id === model.generation.id ? null : model.generation.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
