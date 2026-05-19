import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { drawPlaybackEqualizer } from "../lib/playbackEqualizer";
import Icon from "./Icon";

interface Props {
  playing: boolean;
  level: number;
  onTogglePlay: () => void;
  onRestart: () => void;
}

export default function HistoryItemPlayOverlay({ playing, level, onTogglePlay, onRestart }: Props) {
  const { frequencyDataRef } = usePlayback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const playingRef = useRef(playing);
  const levelRef = useRef(level);
  playingRef.current = playing;
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w > 0 && h > 0) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const freq = frequencyDataRef.current;
        if (freq) {
          drawPlaybackEqualizer(ctx, w, h, freq, playingRef.current, levelRef.current);
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frequencyDataRef]);

  const handleZoneClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      ref={wrapRef}
      className="history-play-overlay"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <canvas ref={canvasRef} className="history-play-overlay__canvas" aria-hidden />
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
