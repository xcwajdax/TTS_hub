import { useEffect, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";

interface Props {
  value: string | null | undefined;
  onChange: (voiceProfileId: string | null) => void;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export default function VoiceProfileSelect({
  value,
  onChange,
  className = "field",
  allowEmpty = true,
  emptyLabel = "Parametry własne (poniżej)",
}: Props) {
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);

  const refresh = () => {
    void getAppSettings()
      .then((view) => setProfiles(view.voice_profiles ?? []))
      .catch(() => setProfiles([]));
  };

  useEffect(() => {
    refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, refresh);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refresh);
  }, []);

  if (profiles.length === 0) {
    return (
      <p className="text-[10px] text-muted leading-snug">
        Brak zapisanych profili głosu. Zapisz profil w panelu „Ustawienia TTS” po lewej.
      </p>
    );
  }

  return (
    <select
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
