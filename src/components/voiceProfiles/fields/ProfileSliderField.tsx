import ProfileScrubInput from "./ProfileScrubInput";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}

export default function ProfileSliderField({ value, onChange, min, max, step, disabled }: Props) {
  return (
    <div className="vp-slider-field">
      <input
        type="range"
        className="vp-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Suwak wartości"
      />
      <ProfileScrubInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
