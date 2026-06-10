import ClearLocalDataPanel from "../../ClearLocalDataPanel";

interface Props {
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onCleared?: () => void;
}

export default function MemoryPage({ onError, onSuccess, onCleared }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Pamięć lokalna</h2>
        <p className="text-xs text-muted">
          Czyszczenie plików generowanych przez aplikację. Ustawienia i profile nie są usuwane.
        </p>
      </header>

      <ClearLocalDataPanel
        onError={onError}
        onSuccess={onSuccess}
        onCleared={onCleared}
      />
    </div>
  );
}
