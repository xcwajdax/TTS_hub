import ProfileFieldShell from "./ProfileFieldShell";
import ProfileSliderField from "./ProfileSliderField";
import VpFormItem from "../VpFormItem";
import {
  VOICEBOX_MODEL_SIZES,
  defaultVoiceBoxGenerationOptions,
  type VoiceBoxGenerationOptions,
  type VoiceBoxModelSize,
} from "../../../lib/voiceboxOptions";

interface Props {
  value: VoiceBoxGenerationOptions;
  onChange: (next: VoiceBoxGenerationOptions) => void;
}

export default function VoiceBoxAdvancedFields({ value, onChange }: Props) {
  const defaults = defaultVoiceBoxGenerationOptions();
  const patch = (partial: Partial<VoiceBoxGenerationOptions>) => onChange({ ...value, ...partial });
  const seed = value.seed ?? null;
  const maxChunk = value.max_chunk_chars ?? defaults.max_chunk_chars ?? 800;
  const crossfade = value.crossfade_ms ?? defaults.crossfade_ms ?? 50;
  const normalize = value.normalize ?? true;

  return (
    <>
      <VpFormItem>
        <ProfileFieldShell
          label="Seed"
          tooltip="Stały seed losowości syntezy Voice Box. Puste pole = losowy."
          defaultHint="losowy"
          voiceProfileUi
          onContextMenuReset={() => patch({ seed: null })}
        >
          <input
            className="vp-field"
            type="number"
            min={0}
            step={1}
            placeholder="losowy"
            value={seed ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                patch({ seed: null });
                return;
              }
              const parsed = Number(raw);
              if (Number.isFinite(parsed) && parsed >= 0) patch({ seed: Math.round(parsed) });
            }}
          />
          <span className="vp-hint">
            {seed == null
              ? "Puste pole — serwer Voice Box wylosuje seed."
              : "To samo (tekst, seed) da powtarzalny wynik."}
          </span>
        </ProfileFieldShell>
      </VpFormItem>

      <VpFormItem>
        <ProfileFieldShell
          label="Rozmiar modelu"
          tooltip="Wariant wag (istotny głównie dla Qwen). Inne silniki mogą zignorować to pole."
          defaultHint="1.7B"
          voiceProfileUi
          onContextMenuReset={() => patch({ model_size: "1.7B" })}
        >
          <select
            className="vp-field"
            value={value.model_size ?? "1.7B"}
            onChange={(e) => patch({ model_size: e.target.value as VoiceBoxModelSize })}
          >
            {VOICEBOX_MODEL_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </ProfileFieldShell>
      </VpFormItem>

      <VpFormItem>
        <ProfileFieldShell
          label="Max znaków na chunk"
          tooltip="Dzielenie długiego tekstu na fragmenty przed syntezą."
          defaultHint="800"
          voiceProfileUi
          onContextMenuReset={() => patch({ max_chunk_chars: 800 })}
        >
          <ProfileSliderField
            value={maxChunk}
            min={100}
            max={5000}
            step={50}
            onChange={(n) => patch({ max_chunk_chars: n })}
          />
        </ProfileFieldShell>
      </VpFormItem>

      <VpFormItem>
        <ProfileFieldShell
          label="Crossfade (ms)"
          tooltip="Płynne łączenie chunków audio. 0 = twarde cięcie."
          defaultHint="50"
          voiceProfileUi
          onContextMenuReset={() => patch({ crossfade_ms: 50 })}
        >
          <ProfileSliderField
            value={crossfade}
            min={0}
            max={500}
            step={5}
            onChange={(n) => patch({ crossfade_ms: n })}
          />
        </ProfileFieldShell>
      </VpFormItem>

      <VpFormItem>
        <ProfileFieldShell
          label="Normalizacja głośności"
          tooltip="Wyrównanie poziomu wyjściowego po syntezie."
          defaultHint="włączone"
          voiceProfileUi
          onContextMenuReset={() => patch({ normalize: true })}
        >
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={normalize}
              onChange={(e) => patch({ normalize: e.target.checked })}
            />
            Włącz normalizację
          </label>
        </ProfileFieldShell>
      </VpFormItem>
    </>
  );
}
