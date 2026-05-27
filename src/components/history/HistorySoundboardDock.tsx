import { useEffect, useState } from "react";
import Icon from "../Icon";
import SoundboardPanel from "../../plugins/soundboard/SoundboardPanel";
import type { Generation } from "../../types";

const STORAGE_KEY = "tts-hub.soundboard-dock-expanded";

function loadExpanded(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface Props {
  filledCount: number;
  historyCandidates: Generation[];
  onError: (message: string) => void;
  onToast?: (message: string) => void;
  onFilledCountChange: (count: number) => void;
  onOpenFullTab: () => void;
  pluginEnabled?: boolean;
}

export default function HistorySoundboardDock({
  filledCount,
  historyCandidates,
  onError,
  onToast,
  onFilledCountChange,
  onOpenFullTab,
  pluginEnabled = true,
}: Props) {
  const [expanded, setExpanded] = useState(loadExpanded);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  return (
    <div className="shrink-0 border-t border-border bg-panel2 flex flex-col max-h-[45%] min-h-0">
      <div className="flex items-center gap-1 px-1 py-0.5 shrink-0">
        <button
          type="button"
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-left text-xs text-heading hover:bg-panel rounded min-w-0"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <Icon name="play" size={14} className="shrink-0 text-accent" />
          <span className="font-medium truncate">Soundboard</span>
          {filledCount > 0 && (
            <span className="text-[10px] tabular-nums text-accent/80">{filledCount}/8</span>
          )}
          <Icon
            name="chevron-down"
            size={14}
            className={`ml-auto shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          className="px-2 py-1 text-[10px] text-muted hover:text-heading shrink-0"
          title="Pełna zakładka Soundboard"
          onClick={onOpenFullTab}
        >
          Pełny
        </button>
      </div>
      {expanded && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-t border-border/60">
          <SoundboardPanel
            variant="embedded"
            onError={onError}
            onToast={onToast}
            historyCandidates={historyCandidates}
            onFilledCountChange={onFilledCountChange}
            pluginEnabled={pluginEnabled}
          />
        </div>
      )}
    </div>
  );
}
