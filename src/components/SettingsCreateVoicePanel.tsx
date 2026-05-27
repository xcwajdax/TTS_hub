import { useEffect, useState } from "react";
import { listMinimaxClonedVoices, type MinimaxClonedVoice } from "../api/tauri";
import type { SettingsState } from "./Settings";
import MinimaxVoiceClone from "./MinimaxVoiceClone";

interface Props {
  settings: SettingsState;
  onChange: (next: SettingsState) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export default function SettingsCreateVoicePanel({
  settings,
  onChange,
  onError,
  onSuccess,
}: Props) {
  const [cloned, setCloned] = useState<MinimaxClonedVoice[]>([]);

  useEffect(() => {
    if (settings.provider !== "minimax") return;
    void listMinimaxClonedVoices()
      .then(setCloned)
      .catch(() => setCloned([]));
  }, [settings.provider]);

  if (settings.provider !== "minimax") {
    return (
      <div className="px-3 py-6 flex flex-col gap-2 text-center">
        <p className="text-sm text-muted">Klonowanie głosu jest dostępne dla providera Minimax.</p>
        <p className="text-[11px] text-muted/80 leading-relaxed">
          Przełącz provider na Minimax Portal w zakładce Ustawienia, aby utworzyć własny głos z
          pliku audio.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="text-[11px] text-muted leading-relaxed">
        Utwórz klon głosu Minimax z nagrania. Po klonowaniu głos pojawi się na liście w zakładce
        Ustawienia.
      </p>
      <MinimaxVoiceClone
        model={settings.model}
        onCloned={(v) => {
          setCloned((prev) => [...prev.filter((c) => c.voice_id !== v.voice_id), v]);
          onChange({ ...settings, voice: v.voice_id });
          onSuccess?.(`Dodano głos „${v.name || v.voice_id}”.`);
        }}
        onError={onError}
      />
      {cloned.length > 0 ? (
        <p className="text-[10px] text-muted">
          Sklonowane głosy w aplikacji: {cloned.length}
        </p>
      ) : null}
    </div>
  );
}
