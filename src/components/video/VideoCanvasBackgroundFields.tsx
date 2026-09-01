import type { VideoBackgroundMode, VideoCanvas } from "../../types/videoTemplate";
import { videoCanvasCssBackground } from "../../types/videoTemplate";

const ANGLE_PRESETS: Array<{ deg: number; label: string }> = [
  { deg: 0, label: "Góra" },
  { deg: 90, label: "Prawo" },
  { deg: 180, label: "Dół" },
  { deg: 270, label: "Lewo" },
];

interface Props {
  canvas: VideoCanvas;
  onChange: (patch: Partial<VideoCanvas>) => void;
}

function toColorInput(value: string | null | undefined, fallback: string): string {
  const hex = (value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}/.test(hex)) return hex.slice(0, 7);
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return fallback;
}

export default function VideoCanvasBackgroundFields({ canvas, onChange }: Props) {
  const mode: VideoBackgroundMode = canvas.backgroundMode ?? "solid";
  const from = toColorInput(canvas.background, "#12141a");
  const to = toColorInput(canvas.backgroundTo, "#000000");
  const angle = Number.isFinite(canvas.backgroundAngle) ? Number(canvas.backgroundAngle) : 180;
  const isGradient = mode === "linear" || mode === "radial";

  const setMode = (next: VideoBackgroundMode) => {
    onChange({
      backgroundMode: next,
      backgroundTo: canvas.backgroundTo?.trim() ? canvas.backgroundTo : "#000000",
      backgroundAngle: canvas.backgroundAngle ?? 180,
    });
  };

  return (
    <div className="border border-border rounded-lg p-2 bg-panel2/30 flex flex-col gap-2 text-xs">
      <p className="text-[10px] uppercase text-muted font-semibold">Płótno / tło</p>
      <label className="flex flex-col gap-0.5">
        <span className="text-muted">Rodzaj tła</span>
        <select
          className="input text-xs py-1"
          value={mode}
          onChange={(e) => setMode(e.target.value as VideoBackgroundMode)}
        >
          <option value="solid">Jednolity kolor</option>
          <option value="linear">Gradient liniowy</option>
          <option value="radial">Gradient promienisty</option>
        </select>
      </label>
      <div className={`grid gap-2 ${isGradient ? "grid-cols-2" : "grid-cols-1"}`}>
        <label className="flex flex-col gap-0.5">
          <span className="text-muted">{isGradient ? "Kolor startowy" : "Kolor tła"}</span>
          <input
            type="color"
            className="h-8 w-full cursor-pointer"
            value={from}
            onChange={(e) => onChange({ background: e.target.value })}
          />
        </label>
        {isGradient && (
          <label className="flex flex-col gap-0.5">
            <span className="text-muted">Kolor końcowy</span>
            <input
              type="color"
              className="h-8 w-full cursor-pointer"
              value={to}
              onChange={(e) => onChange({ backgroundTo: e.target.value })}
            />
          </label>
        )}
      </div>
      {mode === "linear" && (
        <>
          <label className="flex flex-col gap-0.5">
            <span className="text-muted">Kierunek ({angle}°)</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={angle}
              onChange={(e) => onChange({ backgroundAngle: Number(e.target.value) })}
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {ANGLE_PRESETS.map(({ deg, label }) => (
              <button
                key={deg}
                type="button"
                className={[
                  "btn text-[10px] py-0.5 px-1.5",
                  angle === deg ? "bg-accent/20" : "",
                ].join(" ")}
                onClick={() => onChange({ backgroundAngle: deg })}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      <div
        className="h-8 rounded border border-border"
        style={{ background: videoCanvasCssBackground({ ...canvas, background: from, backgroundTo: to, backgroundMode: mode, backgroundAngle: angle }) }}
        title="Podgląd tła"
      />
    </div>
  );
}
