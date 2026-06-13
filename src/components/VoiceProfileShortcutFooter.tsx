import { useEffect, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import {
  findShortcutConflictForProfile,
  persistVoiceProfilesWithHotkeySync,
  updateProfileShortcut,
} from "../lib/voiceProfileShortcuts";
import { migrateLegacyShortcut, shortcutDisplayLabel } from "../lib/quickHotkeyPreset";
import ShortcutInlineField from "./ShortcutInlineField";

interface Props {
  profile: TtsVoiceProfile;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onDelete?: () => void;
}

export default function VoiceProfileShortcutFooter({ profile, onError, onSuccess, onDelete }: Props) {
  const [shortcut, setShortcut] = useState(profile.shortcut ?? "");
  const [hotkeysEnabled, setHotkeysEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShortcut(profile.shortcut ?? "");
    void getAppSettings().then((view) => {
      setHotkeysEnabled(view.quick_hotkeys?.enabled ?? false);
    });
  }, [profile.id, profile.shortcut]);

  const applyShortcut = async (nextShortcut: string) => {
    if (saving) return;
    const normalized = migrateLegacyShortcut(nextShortcut.trim());
    setSaving(true);
    try {
      if (normalized) {
        const view = await getAppSettings();
        const hit = findShortcutConflictForProfile(
          normalized,
          view.quick_hotkeys ?? { enabled: false, presets: [] },
          profile.id,
        );
        if (hit) {
          onError(`Ten skrót jest już używany przez „${hit.name}".`);
          return;
        }
      }
      await updateProfileShortcut(profile.id, normalized, !!normalized);
      setShortcut(normalized);
      onSuccess?.(
        normalized
          ? `Skrót ${shortcutDisplayLabel(normalized)} przypisany do „${profile.name}".`
          : `Usunięto skrót profilu „${profile.name}".`,
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      const view = await getAppSettings();
      const profiles = (view.voice_profiles ?? []).map((p) =>
        p.id === profile.id ? { ...p, shortcut_enabled: enabled } : p,
      );
      await persistVoiceProfilesWithHotkeySync(view, profiles);
      onSuccess?.(enabled ? "Skrót włączony." : "Skrót wyłączony (preset pozostaje w ustawieniach).");
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-panel px-3 py-3 flex flex-col gap-2">
      <div className="text-xs font-medium text-heading truncate" title={profile.name}>
        {profile.name}
      </div>
      {!hotkeysEnabled ? (
        <p className="text-[10px] text-amber-300/90 leading-snug">
          Włącz globalne skróty w Ustawienia → Szybkie skróty, aby skrót działał w całej aplikacji.
        </p>
      ) : null}
      <ShortcutInlineField
        label="Skrót"
        value={shortcut}
        disabled={saving}
        onChange={(next) => void applyShortcut(next)}
      />
      {shortcut.trim() ? (
        <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={profile.shortcut_enabled !== false}
            disabled={saving}
            onChange={(e) => void toggleEnabled(e.target.checked)}
          />
          <span>Skrót aktywny</span>
        </label>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="btn-ghost text-[11px] text-red-300/90 self-start mt-1 hover:!bg-red-900/30"
          disabled={saving}
          onClick={onDelete}
        >
          Usuń profil
        </button>
      ) : null}
    </div>
  );
}
