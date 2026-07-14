/** In-memory mirror of AppSettings.roleplay_mute_preview for sync reads in job callbacks. */
let mutePreview = true;

export function getRoleplayMutePreview(): boolean {
  return mutePreview;
}

export function setRoleplayMutePreview(value: boolean): void {
  mutePreview = value;
}

export const ROLEPLAY_MUTE_PREVIEW_CHANGED = "roleplay-mute-preview-changed";
