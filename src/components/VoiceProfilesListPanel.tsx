import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import { requestGenerateWithVoiceProfile } from "../lib/voiceProfileActions";
import {
  previewTextForProfile,
  sortProfilesForChatList,
} from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { shortcutDisplayLabel } from "../lib/quickHotkeyPreset";
import type { Generation } from "../types";
import VoiceProfileChatRow from "./VoiceProfileChatRow";
import VoiceProfileContextMenu from "./VoiceProfileContextMenu";
import VoiceProfileShortcutFooter from "./VoiceProfileShortcutFooter";

interface Props {
  recentGenerations: Generation[];
  onEditProfile: (profile: TtsVoiceProfile) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export default function VoiceProfilesListPanel({
  recentGenerations,
  onEditProfile,
  onError,
  onSuccess,
}: Props) {
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    profile: TtsVoiceProfile;
    x: number;
    y: number;
  } | null>(null);

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

  const sorted = useMemo(() => sortProfilesForChatList(profiles), [profiles]);

  const selectedProfile = useMemo(
    () => sorted.find((p) => p.id === selectedId) ?? null,
    [sorted, selectedId],
  );

  useEffect(() => {
    if (selectedId && !sorted.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      setContextMenu(null);
    }
  }, [sorted, selectedId]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <p className="text-sm text-muted">Brak zapisanych profili głosu</p>
        <p className="text-[11px] text-muted/80 leading-relaxed">
          W zakładce Ustawienia ustaw parametry TTS i użyj przycisku „Zapisz profil głosu” na dole
          panelu.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <p className="shrink-0 px-3 py-1.5 text-[10px] text-muted border-b border-border/50 leading-snug">
        Kliknij profil — generacja z edytora. Prawy przycisk — edycja ustawień.
      </p>
      <div className="voice-profile-chat-list flex-1 min-h-0 overflow-y-auto">
        {sorted.map((profile) => {
          const preview = previewTextForProfile(profile, recentGenerations);
          const selected = profile.id === selectedId;
          const shortcutHint =
            profile.shortcut?.trim() && profile.shortcut_enabled !== false
              ? shortcutDisplayLabel(profile.shortcut)
              : null;
          return (
            <VoiceProfileChatRow
              key={profile.id}
              profile={profile}
              preview={preview}
              shortcutHint={shortcutHint}
              selected={selected}
              onGenerate={() => requestGenerateWithVoiceProfile(profile.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedId(profile.id);
                setContextMenu({ profile, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}
      </div>
      {selectedProfile ? (
        <VoiceProfileShortcutFooter
          profile={selectedProfile}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : (
        <p className="shrink-0 border-t border-border px-3 py-2 text-[10px] text-muted text-center leading-snug">
          Prawy przycisk na profilu — menu i edycja skrótu poniżej.
        </p>
      )}
      {contextMenu ? (
        <VoiceProfileContextMenu
          profile={contextMenu.profile}
          anchorX={contextMenu.x}
          anchorY={contextMenu.y}
          onEditSettings={() => onEditProfile(contextMenu.profile)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
