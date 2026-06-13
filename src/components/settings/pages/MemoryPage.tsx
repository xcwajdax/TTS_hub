import { useState } from "react";
import ClearLocalDataPanel from "../../ClearLocalDataPanel";
import LocalStorageStatsPanel from "../../LocalStorageStatsPanel";

interface Props {
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onCleared?: () => void;
}

export default function MemoryPage({ onError, onSuccess, onCleared }: Props) {
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Pamięć lokalna</h2>
        <p className="text-xs text-muted">
          Statystyki wykorzystania dysku i czyszczenie plików generowanych przez aplikację.
          Ustawienia i profile głosów nie są usuwane.
        </p>
      </header>

      <LocalStorageStatsPanel onError={onError} refreshKey={statsRefreshKey} />

      <ClearLocalDataPanel
        onError={onError}
        onSuccess={onSuccess}
        onCleared={() => {
          setStatsRefreshKey((k) => k + 1);
          onCleared?.();
        }}
      />
    </div>
  );
}
