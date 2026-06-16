import { useCallback, useEffect, useMemo, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import {
  deleteVoiceProfile,
  isRerouteProfile,
  previewTextForProfile,
  setRerouteVoiceProfile,
  sortProfilesForChatList,
} from "../lib/voiceProfiles";
import { exportVoicePackFromProfile, importVoicePackFromDialog } from "../lib/voicePack";
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
  onProfileDeleted?: (profileId: string) => void;
}

export default function VoiceProfilesListPanel({
  variant = "sidebar",
  recentGenerations,
  activeProfileId,
  onSelectProfile,
  onEditProfile,
  onError,
  onSuccess,
  onProfileDeleted,
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

  const handleDeleteProfile = useCallback(
    (profile: TtsVoiceProfile) => {
      void (async () => {
        const ok = await confirm(
          `Usunąć profil „${profile.name}"? Skrót i reroute globalny zostaną usunięte. Historia generacji pozostaje.`,
          { title: "Usuń profil głosu", kind: "warning" },
        );
        if (!ok) return;
        try {
          await deleteVoiceProfile(profile.id);
          setContextMenu(null);
          onProfileDeleted?.(profile.id);
          onSuccess?.(`Usunięto profil „${profile.name}".`);
        } catch (e) {
          onError(String(e));
        }
      })();
    },
    [onError, onProfileDeleted, onSuccess],
  );

  const handleImportPack = useCallback(() => {
    void (async () => {
      try {
        const profile = await importVoicePackFromDialog();
        if (!profile) return;
        onSelectProfile(profile);
        onSuccess?.(`Zaimportowano Voice Pack „${profile.name}".`);
      } catch (e) {
        onError(String(e));
      }
    })();
  }, [onError, onSelectProfile, onSuccess]);

  const handleExportPack = useCallback(
    (profile: TtsVoiceProfile) => {
      void (async () => {
        try {
          const dest = await exportVoicePackFromProfile(profile);
          if (!dest) return;
          onSuccess?.(`Wyeksportowano Voice Pack „${profile.name}".`);
        } catch (e) {
          onError(String(e));
        }
      })();
    },
    [onError, onSuccess],
  );

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
            ? "Dodaj profil w zakładce Voice Box lub Głosy Minimax, albo użyj „Dodaj do listy profili” przy profilu Voice Box."
            : "Kliknij „Dodaj nowy profil” na dole lub dodaj profil Voice Box w zakładce Voice Box."}
        </p>
        <button
          type="button"
          className="mt-2 text-xs text-accent hover:underline"
          onClick={handleImportPack}
        >
          Importuj Voice Pack…
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div
        className={`shrink-0 flex items-center justify-between gap-2 border-b border-border/50 ${
          variant === "settings" ? "px-4 py-2" : "px-3 py-1.5"
        }`}
      >
        <p className="text-muted leading-snug text-[10px] flex-1 min-w-0">
          Kliknij profil, aby go wybrać. PPM — edycja, eksport Voice Pack, reroute lub usunięcie.
          {rerouteProfileId ? (
            <>
              {" "}
              <span className="text-accent2 font-medium">Reroute aktywny.</span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="shrink-0 text-[10px] px-2 py-1 rounded border border-border/80 hover:border-accent/60 text-muted hover:text-foreground transition-colors"
          onClick={handleImportPack}
        >
          Importuj pack
        </button>
      </div>
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
          onDelete={() => handleDeleteProfile(selectedProfile)}
        />
      ) : (
        <p className="shrink-0 border-t border-border px-3 py-2 text-[10px] text-muted text-center leading-snug">
          Wybierz profil z listy — ustawienia załadują się do syntezy w edytorze.
        </p>
      )}
      {contextMenu ? (
        <VoiceProfileContextMenu
          profile={contextMenu.profile}
          anchorX={contextMenu.x}
          anchorY={contextMenu.y}
          isReroute={isRerouteProfile(contextMenu.profile.id, rerouteProfileId)}
          onEditSettings={() => onEditProfile(contextMenu.profile)}
          onExportPack={() => handleExportPack(contextMenu.profile)}
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
          onDelete={() => handleDeleteProfile(contextMenu.profile)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
