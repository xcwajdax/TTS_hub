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
  editingProfileId?: string | null;
  initialName?: string;
  voiceProfileUi?: boolean;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onSaved?: (profile: TtsVoiceProfile) => void;
}

export default function SaveVoiceProfileFooter({
  settings,
  editingProfileId = null,
  initialName = "",
  voiceProfileUi = false,
  onError,
  onSuccess,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [shortcut, setShortcut] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [hotkeysEnabled, setHotkeysEnabled] = useState(false);
  const [quickPresets, setQuickPresets] = useState<
    import("../appSettings").QuickHotkeyPreset[]
  >([]);

  const loadProfiles = () => {
    void getAppSettings().then((view) => {
      const list = view.voice_profiles ?? [];
      setProfiles(list);
      setHotkeysEnabled(view.quick_hotkeys?.enabled ?? false);
      setQuickPresets(view.quick_hotkeys?.presets ?? []);
      if (editingProfileId) {
        const existing = list.find((p) => p.id === editingProfileId);
        if (existing) {
          setShortcut(existing.shortcut ?? "");
        }
      }
    });
  };

  useEffect(() => {
    loadProfiles();
    const onChanged = () => loadProfiles();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChanged);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProfileId]);

  useEffect(() => {
    setName(initialName);
  }, [initialName, editingProfileId]);

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
    return findShortcutConflict(key, quickPresets, editingProfileId ?? undefined);
  }, [shortcut, quickPresets, editingProfileId]);

  const isEditing = !!editingProfileId;

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
      const existing = editingProfileId
        ? (view.voice_profiles ?? []).find((p) => p.id === editingProfileId)
        : undefined;
      const profile = settingsStateToVoiceProfile(settings, label, editingProfileId ?? undefined, {
        shortcut: normalized || null,
        shortcut_enabled: !!normalized,
      });
      if (existing) {
        profile.last_preview = existing.last_preview;
        profile.last_preview_at = existing.last_preview_at;
      }
      const list = view.voice_profiles ?? [];
      const next = isEditing
        ? list.map((p) => (p.id === profile.id ? profile : p))
        : [...list, profile];
      await persistVoiceProfilesWithHotkeySync(view, next);
      if (!isEditing) {
        setName("");
        setShortcut("");
      }
      loadProfiles();
      onSaved?.(profile);
      onSuccess?.(
        isEditing
          ? `Zaktualizowano profil „${label}".`
          : normalized
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
    <div className={`shrink-0 border-t border-border bg-panel px-3 py-3 flex flex-col gap-3${voiceProfileUi ? " vp-form" : ""}`}>
      <VoiceAvatarControl settings={settings} onError={onError} />
      <div className="flex flex-col gap-1.5 max-w-[var(--vp-field-max,15.5rem)]">
        <label className={voiceProfileUi ? "vp-form__label" : "text-xs text-muted flex flex-col gap-1"}>
          Nazwa profilu głosu
          <input
            className={voiceProfileUi ? "vp-field text-xs" : "field text-xs"}
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
            Skrót zapisie się w ustawieniach — włącz globalne skróty w menu Szybkie skróty.
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
          {saving ? "Zapisywanie…" : isEditing ? "Zapisz zmiany" : "Zapisz profil głosu"}
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
