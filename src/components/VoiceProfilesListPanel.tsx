import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import {
  isRerouteProfile,
  previewTextForProfile,
  setRerouteVoiceProfile,
  sortProfilesForChatList,
} from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { shortcutDisplayLabel } from "../lib/quickHotkeyPreset";
import type { Generation } from "../types";
import VoiceProfileChatRow from "./VoiceProfileChatRow";
import VoiceProfileContextMenu from "./VoiceProfileContextMenu";
import VoiceProfileShortcutFooter from "./VoiceProfileShortcutFooter";

interface Props {
  variant?: "sidebar" | "settings";
  recentGenerations: Generation[];
  activeProfileId: string | null;
  onSelectProfile: (profile: TtsVoiceProfile) => void;
  onEditProfile: (profile: TtsVoiceProfile) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export default function VoiceProfilesListPanel({
  variant = "sidebar",
  recentGenerations,
  activeProfileId,
  onSelectProfile,
  onEditProfile,
  onError,
  onSuccess,
}: Props) {
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [rerouteProfileId, setRerouteProfileId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    profile: TtsVoiceProfile;
    x: number;
    y: number;
  } | null>(null);

  const refresh = () => {
    void getAppSettings()
      .then((view) => {
        setProfiles(view.voice_profiles ?? []);
        setRerouteProfileId(view.reroute_voice_profile_id ?? null);
      })
      .catch(() => {
        setProfiles([]);
        setRerouteProfileId(null);
      });
  };

  useEffect(() => {
    refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, refresh);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refresh);
  }, []);

  const sorted = useMemo(() => sortProfilesForChatList(profiles), [profiles]);

  const selectedProfile = useMemo(
    () => sorted.find((p) => p.id === activeProfileId) ?? null,
    [sorted, activeProfileId],
  );

  useEffect(() => {
    if (activeProfileId && !sorted.some((p) => p.id === activeProfileId)) {
      setContextMenu(null);
    }
  }, [sorted, activeProfileId]);

  if (sorted.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 text-center ${
          variant === "settings" ? "px-6 py-16" : "px-4 py-10"
        }`}
      >
        <p className="text-sm text-muted">Brak zapisanych profili głosu</p>
        <p className="text-[11px] text-muted/80 leading-relaxed max-w-sm">
          {variant === "settings"
            ? "Przejdź do widoku TTS, ustaw parametry syntezy i użyj przycisku „Zapisz profil głosu” na dole panelu bocznego."
            : "Ustaw parametry TTS i użyj przycisku „Zapisz profil głosu” na dole panelu."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <p
        className={`shrink-0 text-muted border-b border-border/50 leading-snug ${
          variant === "settings"
            ? "px-4 py-2 text-[11px]"
            : "px-3 py-1.5 text-[10px]"
        }`}
      >
        Kliknij profil, aby go wybrać. Prawy przycisk — edycja lub reroute globalny (wymusza profil
        dla Cursor, API HTTP i innych klientów).
        {rerouteProfileId ? (
          <>
            {" "}
            <span className="text-accent2 font-medium">Reroute aktywny.</span>
          </>
        ) : null}
      </p>
      <div
        className={`voice-profile-chat-list flex-1 min-h-0 overflow-y-auto ${
          variant === "settings" ? "px-1" : ""
        }`}
      >
        {sorted.map((profile) => {
          const preview = previewTextForProfile(profile, recentGenerations);
          const selected = profile.id === activeProfileId;
          const reroute = isRerouteProfile(profile.id, rerouteProfileId);
          const shortcutHint =
            !reroute && profile.shortcut?.trim() && profile.shortcut_enabled !== false
              ? shortcutDisplayLabel(profile.shortcut)
              : null;
          return (
            <VoiceProfileChatRow
              key={profile.id}
              profile={profile}
              preview={preview}
              shortcutHint={shortcutHint}
              selected={selected}
              isReroute={reroute}
              onSelect={() => onSelectProfile(profile)}
              onContextMenu={(e) => {
                e.preventDefault();
                onSelectProfile(profile);
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
          Wybierz profil z listy — ustawienia załadują się w panelu TTS.
        </p>
      )}
      {contextMenu ? (
        <VoiceProfileContextMenu
          profile={contextMenu.profile}
          anchorX={contextMenu.x}
          anchorY={contextMenu.y}
          isReroute={isRerouteProfile(contextMenu.profile.id, rerouteProfileId)}
          onEditSettings={() => onEditProfile(contextMenu.profile)}
          onSetReroute={() => {
            void setRerouteVoiceProfile(contextMenu.profile.id)
              .then(() => {
                setRerouteProfileId(contextMenu.profile.id);
                onSuccess?.(`Reroute globalny: ${contextMenu.profile.name}`);
              })
              .catch((e) => onError(String(e)));
          }}
          onClearReroute={() => {
            void setRerouteVoiceProfile(null)
              .then(() => {
                setRerouteProfileId(null);
                onSuccess?.("Reroute globalny wyłączony");
              })
              .catch((e) => onError(String(e)));
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
