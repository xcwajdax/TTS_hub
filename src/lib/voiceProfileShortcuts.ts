import {
  appSettingsViewToPayload,
  defaultQuickHotkeyPreset,
  type AppSettingsView,
  type QuickHotkeyPreset,
  type QuickHotkeysSettings,
  type TtsVoiceProfile,
} from "../appSettings";
import { getAppSettings, setAppSettings } from "../api/tauri";
import {
  findShortcutConflict,
  migrateLegacyShortcut,
  settingsStateToPreset,
} from "./quickHotkeyPreset";
import { voiceProfileToSettingsState } from "./voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "./voiceProfilesEvents";

export function findShortcutConflictForProfile(
  shortcut: string,
  quickHotkeys: QuickHotkeysSettings,
  profileId: string,
): QuickHotkeyPreset | null {
  const presetId =
    quickHotkeys.presets.find((p) => p.voice_profile_id === profileId)?.id ?? profileId;
  return findShortcutConflict(shortcut, quickHotkeys.presets, presetId);
}

export function syncQuickHotkeysFromVoiceProfiles(
  quickHotkeys: QuickHotkeysSettings,
  profiles: TtsVoiceProfile[],
): QuickHotkeysSettings {
  let presets = [...quickHotkeys.presets];

  for (const profile of profiles) {
    const shortcut = migrateLegacyShortcut(profile.shortcut?.trim() ?? "");
    const idx = presets.findIndex((p) => p.voice_profile_id === profile.id);

    if (!shortcut) {
      if (idx >= 0) {
        presets[idx] = { ...presets[idx], enabled: false, shortcut: "" };
      }
      continue;
    }

    const tts = voiceProfileToSettingsState(profile);
    const base = idx >= 0 ? presets[idx] : defaultQuickHotkeyPreset(profile.name);
    const enabled = profile.shortcut_enabled !== false;
    const updated: QuickHotkeyPreset = {
      ...settingsStateToPreset(tts, base),
      id: base.id,
      name: profile.name,
      voice_profile_id: profile.id,
      shortcut,
      enabled,
      load_editor: base.load_editor ?? false,
      autoplay: base.autoplay ?? true,
    };

    if (idx >= 0) presets[idx] = updated;
    else presets.push(updated);
  }

  return { ...quickHotkeys, presets };
}

export async function persistVoiceProfilesWithHotkeySync(
  view: AppSettingsView,
  profiles: TtsVoiceProfile[],
): Promise<AppSettingsView> {
  const quick_hotkeys = syncQuickHotkeysFromVoiceProfiles(
    view.quick_hotkeys ?? { enabled: false, presets: [] },
    profiles,
  );
  const next = await setAppSettings(
    appSettingsViewToPayload({
      ...view,
      voice_profiles: profiles,
      quick_hotkeys,
    }),
  );
  window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED));
  return next;
}

export async function updateProfileShortcut(
  profileId: string,
  shortcut: string,
  shortcutEnabled: boolean,
): Promise<void> {
  const view = await getAppSettings();
  const profiles = (view.voice_profiles ?? []).map((p) =>
    p.id === profileId
      ? {
          ...p,
          shortcut: shortcut.trim() || null,
          shortcut_enabled: shortcutEnabled && !!shortcut.trim(),
        }
      : p,
  );
  await persistVoiceProfilesWithHotkeySync(view, profiles);
}
