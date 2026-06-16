import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  deleteVoiceAvatar,
  getVoiceAvatar,
  pickAvatarImage,
  saveVoiceAvatar,
} from "../../api/tauri";
import { notifyAvatarsChanged } from "../../lib/avatars";
import { effectiveVoiceId } from "../../lib/voiceProfiles";
import { isTauriApp } from "../../lib/tauriEnv";
import type { SettingsState } from "../Settings";
import AvatarCropModal from "./AvatarCropModal";
import ProviderAvatar from "../ProviderAvatar";

interface Props {
  settings: SettingsState;
  onError: (message: string) => void;
}

export default function VoiceAvatarControl({ settings, onError }: Props) {
  const provider = settings.provider;
  const voiceId = effectiveVoiceId(settings);
  const [revision, setRevision] = useState(0);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [cropPath, setCropPath] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const bump = () => {
    setRevision((r) => r + 1);
    notifyAvatarsChanged();
  };

  const refreshAvatar = useCallback(() => {
    if (!isTauriApp() || !voiceId.trim()) {
      setAvatarPath(null);
      return;
    }
    getVoiceAvatar(provider, voiceId)
      .then((info) => setAvatarPath(info.path))
      .catch(() => setAvatarPath(null));
  }, [provider, voiceId, revision]);

  useEffect(() => {
    refreshAvatar();
  }, [refreshAvatar]);

  const pickImagePath = async (): Promise<string | null> => {
    if (!isTauriApp()) return null;
    try {
      const fromRust = await pickAvatarImage();
      if (fromRust) return fromRust;
    } catch {
      /* fallback */
    }
    const picked = await open({
      multiple: false,
      filters: [{ name: "Obrazy", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (!picked || Array.isArray(picked)) return null;
    return picked;
  };

  const startCrop = async () => {
    if (!voiceId.trim()) {
      onError("Najpierw wybierz głos lub profil Voice Box.");
      return;
    }
    const path = await pickImagePath();
    if (!path) return;
    setPickerOpen(false);
    setCropPath(path);
  };

  const handleCropSave = async (jpegBase64: string) => {
    if (!voiceId.trim()) return;
    await saveVoiceAvatar(provider, voiceId, jpegBase64);
    bump();
  };

  const removeAvatar = async () => {
    if (!voiceId.trim()) return;
    try {
      await deleteVoiceAvatar(provider, voiceId);
      bump();
    } catch (e) {
      onError(String(e));
    }
  };

  if (!isTauriApp()) {
    return (
      <p className="text-[10px] text-muted leading-snug">
        Awatar głosu jest dostępny w aplikacji desktopowej.
      </p>
    );
  }

  const voiceLabel =
    settings.provider === "voicebox"
      ? settings.voice || settings.voiceboxProfileId
      : settings.voice;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted">Awatar głosu</div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-panel2/50 px-2 py-2">
        <ProviderAvatar
          provider={provider}
          filePath={avatarPath}
          fallbackLabel={voiceLabel}
          size={40}
          cacheKey={revision}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted truncate" title={voiceId}>
            {provider} · {voiceId || "—"}
          </div>
        </div>
        <button
          type="button"
          className="btn text-[10px] px-2 py-1 shrink-0"
          onClick={() => setPickerOpen((o) => !o)}
          disabled={!voiceId.trim()}
        >
          Wybierz
        </button>
      </div>
      {pickerOpen ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-panel2/30 p-2">
          <p className="text-[10px] text-muted leading-snug">
            Wgraj własny obraz z dysku (kadrowanie 512×512). Awatar jest powiązany z bieżącym
            głosem w ustawieniach.
          </p>
          <div className="flex flex-wrap gap-1">
            <button type="button" className="btn text-[10px] px-2 py-1" onClick={() => void startCrop()}>
              {avatarPath ? "Zmień z dysku" : "Dodaj z dysku"}
            </button>
            {avatarPath ? (
              <button type="button" className="btn text-[10px] px-2 py-1" onClick={() => void removeAvatar()}>
                Usuń awatar
              </button>
            ) : null}
            <button
              type="button"
              className="btn text-[10px] px-2 py-1"
              onClick={() => setPickerOpen(false)}
            >
              Zamknij
            </button>
          </div>
        </div>
      ) : null}
      {cropPath ? (
        <AvatarCropModal
          open
          imagePath={cropPath}
          title={`Awatar — ${voiceLabel}`}
          onClose={() => setCropPath(null)}
          onSave={handleCropSave}
        />
      ) : null}
    </div>
  );
}
