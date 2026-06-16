import { listen } from "@tauri-apps/api/event";

export const MP4_CLIPBOARD_SUCCESS_TOAST =
  "MP4 w schowku · zapisano w bibliotece Wideo (wklej w WhatsApp jako plik wideo).";

export const AUDIO_CLIPBOARD_SUCCESS_TOAST = "Audio skopiowane do schowka.";

export interface Mp4ExportProgress {
  id: string;
  phase: "start" | "render" | "done" | "error";
  percent: number;
  message: string;
}

export function subscribeMp4ExportProgress(
  generationId: string,
  onUpdate: (progress: Mp4ExportProgress) => void,
): Promise<() => void> {
  return listen<Mp4ExportProgress>("mp4-export-progress", (event) => {
    if (event.payload.id === generationId) {
      onUpdate(event.payload);
    }
  }).then((unlisten) => unlisten);
}
