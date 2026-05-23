import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  deleteSourceAvatar,
  deleteVoiceAvatar,
  getVoiceAvatar,
  listMinimaxClonedVoices,
  listMinimaxPresetVoices,
  listVoiceboxProfiles,
  listVoices,
  openAvatarsFolder,
  pickAvatarImage,
  saveSourceAvatar,
  saveVoiceAvatar,
} from "../../api/tauri";
import { isTauriApp } from "../../lib/tauriEnv";
import { notifyAvatarsChanged, SOURCE_AVATAR_IDS } from "../../lib/avatars";
import { getSourceUi } from "../../lib/historySourceUi";
import { useSourceAvatars } from "../../hooks/useAvatars";
import type { GenerationSource, TtsProvider } from "../../types";
import AvatarCropModal from "./AvatarCropModal";
import AvatarImage from "./AvatarImage";

type CropTarget =
  | { kind: "source"; source: GenerationSource }
  | { kind: "voice"; provider: TtsProvider; voiceId: string; label: string };

interface Props {
  onError: (message: string) => void;
}

export default function AvatarsSettingsPanel({ onError }: Props) {
  const sourcePaths = useSourceAvatars();
  const [revision, setRevision] = useState(0);
  const [crop, setCrop] = useState<{ path: string; target: CropTarget } | null>(null);

  const [googleVoices, setGoogleVoices] = useState<string[]>([]);
  const [minimaxPresets, setMinimaxPresets] = useState<{ id: string; label: string }[]>([]);
  const [minimaxCloned, setMinimaxCloned] = useState<{ id: string; label: string }[]>([]);
  const [voiceboxProfiles, setVoiceboxProfiles] = useState<{ id: string; label: string }[]>([]);

  const [voiceProvider, setVoiceProvider] = useState<TtsProvider>("google");
  const [voiceId, setVoiceId] = useState("");
  const [voiceAvatarPath, setVoiceAvatarPath] = useState<string | null>(null);

  const bump = () => {
    setRevision((r) => r + 1);
    notifyAvatarsChanged();
  };

  const loadVoiceLists = useCallback(async () => {
    try {
      const [gv, mp, mc, vb] = await Promise.all([
        listVoices(),
        listMinimaxPresetVoices(),
        listMinimaxClonedVoices(),
        listVoiceboxProfiles(),
      ]);
      setGoogleVoices(gv);
      setMinimaxPresets(
        mp.map((v) => ({
          id: v.voice_id,
          label: v.display_name?.trim() || v.voice_id,
        })),
      );
      setMinimaxCloned(
        mc.map((v) => ({
          id: v.voice_id,
          label: v.name?.trim() || v.voice_id,
        })),
      );
      setVoiceboxProfiles(
        vb.map((p) => ({
          id: p.id,
          label: p.name?.trim() || p.id,
        })),
      );
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void loadVoiceLists();
  }, [loadVoiceLists]);

  const voiceOptions =
    voiceProvider === "google"
      ? googleVoices.map((v) => ({ id: v, label: v }))
      : voiceProvider === "minimax"
        ? [...minimaxPresets, ...minimaxCloned]
        : voiceboxProfiles;

  useEffect(() => {
    if (voiceOptions.length === 0) {
      setVoiceId("");
      return;
    }
    if (!voiceOptions.some((o) => o.id === voiceId)) {
      setVoiceId(voiceOptions[0].id);
    }
  }, [voiceProvider, voiceOptions, voiceId]);

  useEffect(() => {
    if (!voiceId.trim() || !isTauriApp()) {
      setVoiceAvatarPath(null);
      return;
    }
    getVoiceAvatar(voiceProvider, voiceId)
      .then((info) => setVoiceAvatarPath(info.path))
      .catch(() => setVoiceAvatarPath(null));
  }, [voiceProvider, voiceId, revision]);

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

  const startSourceCrop = async (source: GenerationSource) => {
    const path = await pickImagePath();
    if (!path) return;
    setCrop({ path, target: { kind: "source", source } });
  };

  const startVoiceCrop = async () => {
    if (!voiceId.trim()) return;
    const path = await pickImagePath();
    if (!path) return;
    const label = voiceOptions.find((o) => o.id === voiceId)?.label ?? voiceId;
    setCrop({
      path,
      target: { kind: "voice", provider: voiceProvider, voiceId, label },
    });
  };

  const handleCropSave = async (jpegBase64: string) => {
    if (!crop) return;
    if (crop.target.kind === "source") {
      await saveSourceAvatar(crop.target.source, jpegBase64);
    } else {
      await saveVoiceAvatar(crop.target.provider, crop.target.voiceId, jpegBase64);
    }
    bump();
  };

  const removeSource = async (source: GenerationSource) => {
    try {
      await deleteSourceAvatar(source);
      bump();
    } catch (e) {
      onError(String(e));
    }
  };

  const removeVoice = async () => {
    if (!voiceId.trim()) return;
    try {
      await deleteVoiceAvatar(voiceProvider, voiceId);
      bump();
    } catch (e) {
      onError(String(e));
    }
  };

  if (!isTauriApp()) {
    return (
      <p className="text-xs text-muted">
        Awatary są dostępne tylko w aplikacji desktopowej Tauri.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Źródła generacji</h3>
        <p className="text-[11px] text-muted">
          Awatar JPG 512×512 px w historii i filtrach źródeł. Domyślnie ikona SVG.
        </p>
        <ul className="flex flex-col gap-2">
          {SOURCE_AVATAR_IDS.map((source) => {
            const ui = getSourceUi(source);
            const path = sourcePaths[source];
            return (
              <li
                key={source}
                className="flex items-center gap-3 rounded-md border border-border bg-panel2/50 px-3 py-2"
              >
                <AvatarImage
                  filePath={path}
                  fallbackIcon={ui.icon}
                  size={40}
                  cacheKey={revision}
                  title={ui.label}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{ui.label}</div>
                  <div className="text-[10px] text-muted truncate">{source}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn text-[10px] px-2 py-1"
                    onClick={() => void startSourceCrop(source)}
                  >
                    {path ? "Zmień" : "Dodaj"}
                  </button>
                  {path ? (
                    <button
                      type="button"
                      className="btn text-[10px] px-2 py-1"
                      onClick={() => void removeSource(source)}
                    >
                      Usuń
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Głosy TTS</h3>
        <p className="text-[11px] text-muted">
          Awatar przypisany do providera i identyfikatora głosu (np. w siatce próbek Google).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Provider
            <select
              className="field"
              value={voiceProvider}
              onChange={(e) => setVoiceProvider(e.target.value as TtsProvider)}
            >
              <option value="google">Google</option>
              <option value="minimax">Minimax</option>
              <option value="voicebox">Voice Box</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Głos
            <select
              className="field"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={voiceOptions.length === 0}
            >
              {voiceOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-panel2/50 px-3 py-2">
          <AvatarImage
            filePath={voiceAvatarPath}
            fallbackLabel={voiceOptions.find((o) => o.id === voiceId)?.label}
            size={48}
            cacheKey={revision}
          />
          <div className="flex gap-1 ml-auto shrink-0">
            <button
              type="button"
              className="btn text-[10px] px-2 py-1"
              onClick={() => void startVoiceCrop()}
              disabled={!voiceId.trim()}
            >
              {voiceAvatarPath ? "Zmień" : "Dodaj"}
            </button>
            {voiceAvatarPath ? (
              <button type="button" className="btn text-[10px] px-2 py-1" onClick={() => void removeVoice()}>
                Usuń
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn text-xs"
          onClick={() => void openAvatarsFolder().catch((e) => onError(String(e)))}
        >
          Otwórz folder awatarów
        </button>
      </div>

      {crop ? (
        <AvatarCropModal
          open
          imagePath={crop.path}
          title={
            crop.target.kind === "source"
              ? `Awatar — ${getSourceUi(crop.target.source).label}`
              : `Awatar — ${crop.target.label}`
          }
          onClose={() => setCrop(null)}
          onSave={handleCropSave}
        />
      ) : null}
    </div>
  );
}
