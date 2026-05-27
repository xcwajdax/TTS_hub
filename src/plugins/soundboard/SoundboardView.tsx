import SoundboardPanel from "./SoundboardPanel";
import { useSoundboardPlugin } from "../useSoundboardPlugin";

interface Props {
  onBack: () => void;
  onError: (message: string) => void;
  onToast?: (message: string) => void;
}

export default function SoundboardView({ onBack, onError, onToast }: Props) {
  const { installed, enabled } = useSoundboardPlugin();

  if (!installed) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-panel">
        <header className="shrink-0 px-6 py-4 border-b border-border flex items-center gap-4">
          <button
            type="button"
            className="text-sm text-muted hover:text-heading"
            onClick={onBack}
          >
            ← Hub
          </button>
          <h1 className="text-lg font-semibold text-heading">Soundboard</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted text-center max-w-md">
            Soundboard nie jest zainstalowany. Wróć do huba rozszerzeń i kliknij{" "}
            <strong className="text-heading">Zainstaluj</strong>, potem włącz moduł przełącznikiem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SoundboardPanel
      variant="full"
      onBack={onBack}
      onError={onError}
      onToast={onToast}
      pluginEnabled={enabled}
    />
  );
}
