import {
  exportVoiceProfilePack,
  importVoiceProfilePack,
  importVoiceProfilePackFromUrl,
  pickVoicePackArchive,
  pickVoicePackExportPath,
} from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import { VOICE_PROFILES_CHANGED } from "./voiceProfilesEvents";

function notifyProfilesChanged() {
  window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED));
}

export async function importVoicePackFromDialog(): Promise<TtsVoiceProfile | null> {
  const path = await pickVoicePackArchive();
  if (!path) return null;
  const profile = await importVoiceProfilePack(path);
  notifyProfilesChanged();
  return profile;
}

export async function importVoicePackFromUrl(url: string): Promise<TtsVoiceProfile> {
  const profile = await importVoiceProfilePackFromUrl(url.trim());
  notifyProfilesChanged();
  return profile;
}

export async function exportVoicePackFromProfile(profile: TtsVoiceProfile): Promise<string | null> {
  const packId = profile.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "voice-pack";
  const dest = await pickVoicePackExportPath(packId);
  if (!dest) return null;
  await exportVoiceProfilePack(profile.id, dest);
  return dest;
}
