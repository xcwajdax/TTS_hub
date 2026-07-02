import { useRef } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundStep(n: number, step: number): number {
  if (step < 1) return Math.round(n / step) * step;
  return Math.round(n);
}

export default function ProfileScrubInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled,
}: Props) {
  const dragRef = useRef<{ y: number; value: number } | null>(null);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    dragRef.current = { y: e.clientY, value };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.y - e.clientY;
    const steps = Math.round(dy / 5);
    if (steps === 0) return;
    const next = clamp(dragRef.current.value + steps * step, min, max);
    onChange(roundStep(next, step));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="vp-scrub-input">
      <input
        type="number"
        className="vp-scrub-input__value"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
        }}
      />
      <button
        type="button"
        className="vp-scrub-input__handle"
        disabled={disabled}
        title="Złap strzałki i przeciągnij góra/dół"
        aria-label="Zmień wartość przeciągając góra lub dół"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <span>▲</span>
        <span>▼</span>
      </button>
    </div>
  );
}
