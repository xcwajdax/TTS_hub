import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import { type TtsVoiceProfile } from "../appSettings";
import { persistVoiceProfilesWithHotkeySync } from "../lib/voiceProfileShortcuts";
import { findShortcutConflict, migrateLegacyShortcut } from "../lib/quickHotkeyPreset";
import { settingsStateToVoiceProfile } from "../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { SettingsState } from "./Settings";
import VoiceAvatarControl from "./avatars/VoiceAvatarControl";
import ShortcutInlineField from "./ShortcutInlineField";

interface Props {
  settings: SettingsState;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

export default function SaveVoiceProfileFooter({ settings, onError, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [hotkeysEnabled, setHotkeysEnabled] = useState(false);
  const [quickPresets, setQuickPresets] = useState<
    import("../appSettings").QuickHotkeyPreset[]
  >([]);

  const loadProfiles = () => {
    void getAppSettings().then((view) => {
      setProfiles(view.voice_profiles ?? []);
      setHotkeysEnabled(view.quick_hotkeys?.enabled ?? false);
      setQuickPresets(view.quick_hotkeys?.presets ?? []);
    });
  };

  useEffect(() => {
    loadProfiles();
    const onChanged = () => loadProfiles();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChanged);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, onChanged);
  }, []);

  const defaultName = () => {
    const voice =
      settings.provider === "voicebox"
        ? settings.voice || settings.voiceboxProfileId
        : settings.voice;
    return `Profil: ${voice || settings.provider}`;
  };

  const conflict = useMemo(() => {
    const key = migrateLegacyShortcut(shortcut.trim());
    if (!key) return null;
    return findShortcutConflict(key, quickPresets);
  }, [shortcut, quickPresets]);

  const saveProfile = async () => {
    if (saving) return;
    const normalized = migrateLegacyShortcut(shortcut.trim());
    if (normalized && conflict) {
      onError(`Ten skrót jest już używany przez „${conflict.name}".`);
      return;
    }
    setSaving(true);
    try {
      const view = await getAppSettings();
      const label = name.trim() || defaultName();
      const profile = settingsStateToVoiceProfile(settings, label, undefined, {
        shortcut: normalized || null,
        shortcut_enabled: !!normalized,
      });
      const next = [...(view.voice_profiles ?? []), profile];
      await persistVoiceProfilesWithHotkeySync(view, next);
      setName("");
      setShortcut("");
      loadProfiles();
      onSuccess?.(
        normalized
          ? `Zapisano profil „${label}” ze skrótem.`
          : `Zapisano profil głosu „${label}”.`,
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-panel px-3 py-3 flex flex-col gap-3">
      <VoiceAvatarControl settings={settings} onError={onError} />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted flex flex-col gap-1">
          Nazwa profilu głosu
          <input
            className="field text-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveProfile();
            }}
          />
        </label>
        {!hotkeysEnabled && shortcut.trim() ? (
          <p className="text-[10px] text-amber-300/90 leading-snug">
            Skrót zapisze się w ustawieniach — włącz globalne skróty w menu Szybkie skróty.
          </p>
        ) : null}
        <ShortcutInlineField
          label="Skrót"
          value={shortcut}
          disabled={saving}
          conflictMessage={conflict ? `Zajęty: ${conflict.name}` : null}
          onChange={setShortcut}
        />
        <button
          type="button"
          className="btn-primary text-xs w-full py-2"
          disabled={saving}
          onClick={() => void saveProfile()}
        >
          {saving ? "Zapisywanie…" : "Zapisz profil głosu"}
        </button>
        {profiles.length > 0 ? (
          <p className="text-[10px] text-muted">
            Zapisane profile: {profiles.length}. Skróty synchronizują się z Szybkimi skrótami TTS.
          </p>
        ) : null}
      </div>
    </div>
  );
}
