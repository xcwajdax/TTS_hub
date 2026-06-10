import type { TtsVoiceProfile } from "../appSettings";
import type { PaletteEntry } from "./types";
import { ROLEPLAY_COLORS, profileLabel } from "./types";

interface Props {
  palette: PaletteEntry[];
  profiles: TtsVoiceProfile[];
  activeColor: string | null;
  onPaletteChange: (palette: PaletteEntry[]) => void;
  onActiveColor: (color: string | null) => void;
}

export default function VoicePalette({
  palette,
  profiles,
  activeColor,
  onPaletteChange,
  onActiveColor,
}: Props) {
  const setProfileForColor = (color: string, voiceProfileId: string) => {
    const next = [...palette.filter((p) => p.color !== color)];
    if (voiceProfileId) next.push({ color, voiceProfileId });
    onPaletteChange(next);
  };

  return (
    <div className="border border-border rounded-lg bg-panel p-3 space-y-2 shrink-0">
      <div className="text-xs font-medium text-heading uppercase tracking-wide">Mazaki głosów</div>
      <p className="text-xs text-muted">
        Wybierz kolor, przypisz profil, zaznacz tekst w edytorze. Niezaznaczony tekst nie trafi do generacji.
      </p>
      <div className="flex flex-col gap-2">
        {ROLEPLAY_COLORS.map((color) => {
          const entry = palette.find((p) => p.color === color);
          const isActive = activeColor === color;
          return (
            <div
              key={color}
              className={`flex items-center gap-2 rounded-md p-1.5 ${isActive ? "ring-1 ring-accent bg-panel2" : ""}`}
            >
              <button
                type="button"
                title="Aktywny pędzel"
                className="w-7 h-7 rounded border border-border shrink-0"
                style={{ backgroundColor: color }}
                onClick={() => onActiveColor(isActive ? null : color)}
              />
              <select
                className="flex-1 text-xs bg-panel border border-border rounded px-2 py-1"
                value={entry?.voiceProfileId ?? ""}
                onChange={(e) => setProfileForColor(color, e.target.value)}
              >
                <option value="">— profil głosu —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.provider})
                  </option>
                ))}
              </select>
              {entry?.voiceProfileId && (
                <span className="text-[10px] text-muted truncate max-w-[80px]">
                  {profileLabel(profiles, entry.voiceProfileId)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
