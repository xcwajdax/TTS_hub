interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export default function RoleplayGainSlider({
  value,
  onChange,
  min = -24,
  max = 12,
  step = 0.5,
  label = "Głośność",
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`;

  return (
    <div
      className="roleplay-gain-slider"
      title={`${label}: ${display}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="roleplay-gain-slider__track">
        <div className="roleplay-gain-slider__fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          className="roleplay-gain-slider__input"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <span className="roleplay-gain-slider__value">{display}</span>
    </div>
  );
}
