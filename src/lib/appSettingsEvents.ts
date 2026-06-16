export const APP_SETTINGS_CHANGED = "tts-hub-app-settings-changed";

export function dispatchAppSettingsChanged(): void {
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED));
}
