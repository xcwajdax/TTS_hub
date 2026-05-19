import { getAppSettings } from "./api/tauri";
import type { AudioFormat } from "./types";

export const AUDIO_FORMATS: AudioFormat[] = ["wav", "mp3", "ogg"];

const SAVE_FORMAT_KEY = "tts-hub-save-format";

export function loadSaveFormat(): AudioFormat {
  try {
    const s = localStorage.getItem(SAVE_FORMAT_KEY);
    if (s === "wav" || s === "mp3" || s === "ogg") return s;
  } catch {
    /* ignore */
  }
  return "wav";
}

export function storeSaveFormat(format: AudioFormat): void {
  try {
    localStorage.setItem(SAVE_FORMAT_KEY, format);
  } catch {
    /* ignore */
  }
}

/** Pull save format from backend settings.json and mirror to localStorage. */
export async function syncSaveFormatFromSettings(): Promise<AudioFormat> {
  try {
    const view = await getAppSettings();
    const fmt = view.save_format;
    if (fmt === "wav" || fmt === "mp3" || fmt === "ogg") {
      storeSaveFormat(fmt);
      return fmt;
    }
  } catch {
    /* ignore */
  }
  return loadSaveFormat();
}
