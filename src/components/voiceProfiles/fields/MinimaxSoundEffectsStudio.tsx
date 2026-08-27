import type { MinimaxSoundEffect } from "../../../lib/minimaxOptions";
import { MINIMAX_SOUND_EFFECTS } from "../../../lib/minimaxVoiceModify";

interface Props {
  value: MinimaxSoundEffect | null | undefined;
  onChange: (next: MinimaxSoundEffect | null) => void;
  disabled?: boolean;
}

export default function MinimaxSoundEffectsStudio({ value, onChange, disabled }: Props) {
  const selected = value ?? null;
  const selectedMeta = MINIMAX_SOUND_EFFECTS.find((s) => s.id === selected) ?? null;

  return (
    <div className="vp-sfx-studio">
      <div className="vp-sfx-studio__chain" aria-label="Łańcuch efektów MiniMax">
        <span className="vp-sfx-studio__slot vp-sfx-studio__slot--source">Głos</span>
        <span className="vp-sfx-studio__arrow" aria-hidden>
          →
        </span>
        <span className={`vp-sfx-studio__slot${selected ? " vp-sfx-studio__slot--active" : ""}`}>
          {selectedMeta ? selectedMeta.label : "Bez efektu"}
        </span>
      </div>
      <p className="vp-hint">
        MiniMax przyjmuje jeden preset na żądanie (`sound_effects`). To nie jest łańcuch DSP Voice
        Box.
      </p>
      <div className="vp-sfx-studio__grid" role="listbox" aria-label="Preset efektu MiniMax">
        <button
          type="button"
          role="option"
          aria-selected={!selected}
          className={`vp-sfx-card${!selected ? " vp-sfx-card--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!disabled) onChange(null);
          }}
        >
          <strong>Bez efektu</strong>
          <span>Czysty głos bez post-processingu MiniMax.</span>
        </button>
        {MINIMAX_SOUND_EFFECTS.map((fx) => {
          const active = selected === fx.id;
          return (
            <button
              key={fx.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`vp-sfx-card${active ? " vp-sfx-card--active" : ""}`}
              disabled={disabled}
              onClick={() => onChange(active ? null : fx.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!disabled) onChange(null);
              }}
            >
              <strong>{fx.label}</strong>
              <span>{fx.description}</span>
              <code>{fx.id}</code>
            </button>
          );
        })}
      </div>
    </div>
  );
}
