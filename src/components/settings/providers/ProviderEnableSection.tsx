import { ALL_TTS_PROVIDERS, type TtsProviderId } from "../../../appSettings";
import { PROVIDER_LABELS } from "./providerLabels";

interface Props {
  selected: TtsProviderId[];
  onChange: (next: TtsProviderId[]) => void;
  compact?: boolean;
}

export default function ProviderEnableSection({ selected, onChange, compact }: Props) {
  const toggle = (id: TtsProviderId) => {
    if (selected.includes(id)) {
      const next = selected.filter((p) => p !== id);
      if (next.length > 0) onChange(next);
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!compact ? (
        <p className="text-[11px] text-muted">Zaznacz co najmniej jednego providera TTS.</p>
      ) : null}
      {ALL_TTS_PROVIDERS.map((id) => {
        const meta = PROVIDER_LABELS[id];
        const checked = selected.includes(id);
        return (
          <label
            key={id}
            className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              checked ? "border-accent2 bg-accent2/10" : "border-border hover:border-muted"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checked}
              onChange={() => toggle(id)}
            />
            <span>
              <span className="font-medium text-sm block">{meta.title}</span>
              <span className="text-xs text-muted">{meta.desc}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
