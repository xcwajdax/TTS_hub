interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

export default function RoleplayZoomSlider({ value, onChange, min, max }: Props) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="roleplay-zoom-slider">
      <span className="roleplay-zoom-slider__label">Zoom</span>
      <div className="roleplay-gain-slider__track roleplay-zoom-slider__track">
        <div className="roleplay-gain-slider__fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          className="roleplay-gain-slider__input"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label="Zoom osi czasu"
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <span className="roleplay-zoom-slider__value">{value}px/s</span>
    </div>
  );
}
