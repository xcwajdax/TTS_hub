import { useEffect, useState } from "react";
import AvatarsSettingsPanel from "../../avatars/AvatarsSettingsPanel";
import { listVoices } from "../../../api/tauri";

interface Props {
  onError: (m: string) => void;
}

export default function AvatarsPage({ onError }: Props) {
  const [voices, setVoices] = useState<string[]>([]);

  useEffect(() => {
    listVoices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Awatary</h2>
        <p className="text-xs text-muted">
          Awatary źródeł (TTS / HTTP / Cursor / Skrót) i poszczególnych głosów. Pojawiają się w
          historii.
        </p>
      </header>

      <AvatarsSettingsPanel onError={onError} initialGoogleVoices={voices} />
    </div>
  );
}
