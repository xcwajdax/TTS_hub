import { useState, type MouseEvent } from "react";
import Icon from "./Icon";

interface Props {
  playing: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
}

export default function HistoryItemPlayOverlay({ playing, onTogglePlay, onRestart }: Props) {
  const [hovered, setHovered] = useState(false);

  const handleZoneClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      className="history-play-overlay"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="history-play-overlay__dim" aria-hidden />

      <div className={`history-play-overlay__zones${hovered ? " history-play-overlay__zones--hover" : ""}`}>
        <button
          type="button"
          className="history-play-overlay__zone history-play-overlay__zone--play"
          onClick={(e) => handleZoneClick(e, onTogglePlay)}
          title={playing ? "Pauza" : "Odtwarzaj"}
          aria-label={playing ? "Pauza" : "Odtwarzaj"}
        >
          <Icon name={playing ? "pause" : "play"} size={22} className="history-play-overlay__zone-icon" />
        </button>
        <button
          type="button"
          className="history-play-overlay__zone history-play-overlay__zone--reload"
          onClick={(e) => handleZoneClick(e, onRestart)}
          title="Od początku"
          aria-label="Odtworz od początku"
        >
          <Icon name="reload" size={20} className="history-play-overlay__zone-icon" />
        </button>
      </div>
    </div>
  );
}
