import { useCallback, useRef } from "react";
import type { MinimaxVoiceModify } from "../../../lib/minimaxOptions";
import {
  VOICE_MODIFY_MAX,
  VOICE_MODIFY_MIN,
  applyPadPoint,
  voiceModifyToPad,
} from "../../../lib/minimaxVoiceModify";

interface Props {
  value: MinimaxVoiceModify;
  onChange: (next: MinimaxVoiceModify) => void;
  disabled?: boolean;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clientPointToPad(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const nx = clamp01((clientX - rect.left) / Math.max(1, rect.width));
  const ny = clamp01((clientY - rect.top) / Math.max(1, rect.height));
  const x = Math.round(VOICE_MODIFY_MIN + nx * (VOICE_MODIFY_MAX - VOICE_MODIFY_MIN));
  const y = Math.round(VOICE_MODIFY_MAX - ny * (VOICE_MODIFY_MAX - VOICE_MODIFY_MIN));
  return { x, y };
}

export default function VoiceModifyXyPad({ value, onChange, disabled }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pad = voiceModifyToPad(value);
  const leftPct = ((pad.x - VOICE_MODIFY_MIN) / (VOICE_MODIFY_MAX - VOICE_MODIFY_MIN)) * 100;
  const topPct = ((VOICE_MODIFY_MAX - pad.y) / (VOICE_MODIFY_MAX - VOICE_MODIFY_MIN)) * 100;

  const applyFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !surfaceRef.current) return;
      const next = clientPointToPad(surfaceRef.current, e.clientX, e.clientY);
      onChange(applyPadPoint(value, next.x, next.y));
    },
    [disabled, onChange, value],
  );

  return (
    <div className="vp-xy-pad">
      <div className="vp-xy-pad__stage">
        <div
          ref={surfaceRef}
          className="vp-xy-pad__surface"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Płaszczyzna voice_modify: jasność (X) i siła (Y)"
          aria-valuemin={VOICE_MODIFY_MIN}
          aria-valuemax={VOICE_MODIFY_MAX}
          aria-valuenow={pad.x}
          aria-valuetext={`jasność ${pad.x}, siła ${pad.y}`}
          title="Przeciągnij, żeby ustawić jasność i siłę. Prawy przycisk resetuje obie osie."
          onPointerDown={(e) => {
            if (disabled || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            applyFromEvent(e);
          }}
          onPointerMove={(e) => {
            if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
            applyFromEvent(e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (disabled) return;
            onChange(applyPadPoint(value, 0, 0));
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const step = e.shiftKey ? 1 : 5;
            let { x, y } = pad;
            if (e.key === "ArrowLeft") x -= step;
            else if (e.key === "ArrowRight") x += step;
            else if (e.key === "ArrowUp") y += step;
            else if (e.key === "ArrowDown") y -= step;
            else if (e.key === "Home") {
              x = 0;
              y = 0;
            } else return;
            e.preventDefault();
            onChange(applyPadPoint(value, x, y));
          }}
        >
          <span className="vp-xy-pad__caption vp-xy-pad__caption--top">Mocniej</span>
          <span className="vp-xy-pad__caption vp-xy-pad__caption--bottom">Miękcej</span>
          <span className="vp-xy-pad__caption vp-xy-pad__caption--left">Głębiej</span>
          <span className="vp-xy-pad__caption vp-xy-pad__caption--right">Jaśniej</span>
          <span className="vp-xy-pad__axis vp-xy-pad__axis--x" />
          <span className="vp-xy-pad__axis vp-xy-pad__axis--y" />
          <span
            className="vp-xy-pad__thumb"
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          />
        </div>
        <div className="vp-xy-pad__readout" aria-hidden>
          <span>pitch {value.pitch}</span>
          <span>intensity {value.intensity}</span>
        </div>
      </div>
    </div>
  );
}
