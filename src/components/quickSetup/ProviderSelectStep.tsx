import type { TtsProviderId } from "../../appSettings";
import { ALL_TTS_PROVIDERS } from "../../appSettings";
import QuickSetupHelp from "./QuickSetupHelp";

const LABELS: Record<TtsProviderId, { title: string; desc: string }> = {
  google: {
    title: "Google Gemini",
    desc: "Chmura — modele Gemini TTS, klucz API",
  },
  voicebox: {
    title: "Voice Box",
    desc: "Lokalny serwer HTTP — profile głosu",
  },
  minimax: {
    title: "MiniMax Portal",
    desc: "Chmura — WebSocket TTS, klucz API",
  },
};

interface Props {
  selected: TtsProviderId[];
  onChange: (next: TtsProviderId[]) => void;
}

export default function ProviderSelectStep({ selected, onChange }: Props) {
  const toggle = (id: TtsProviderId) => {
    if (selected.includes(id)) {
      const next = selected.filter((p) => p !== id);
      if (next.length > 0) onChange(next);
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Zaznacz co najmniej jednego providera.</p>
      <div className="flex flex-col gap-2">
        {ALL_TTS_PROVIDERS.map((id) => {
          const meta = LABELS[id];
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
      <QuickSetupHelp topic="intro" />
    </div>
  );
}
