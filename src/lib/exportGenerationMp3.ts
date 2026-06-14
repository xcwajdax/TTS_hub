import { save } from "@tauri-apps/plugin-dialog";
import { exportGenerationMp4ToPath, exportGenerationToPath } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";
import { displayTitle } from "./generationTitle";
import { resolveProfileForGeneration } from "./voiceProfiles";

function sanitizeFilename(input: string): string {
  let out = "";
  for (const c of input.trim()) {
    if (c.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(c)) continue;
    out += c;
  }
  const trimmed = out.trim();
  if (!trimmed) return "TTS Hub";
  if (trimmed.length > 72) return `${trimmed.slice(0, 72)}…`;
  return trimmed;
}

/** Suggested filename stem for MP3 export (title + voice profile). */
export function mp3ExportDefaultStem(
  gen: Generation,
  voiceProfiles: TtsVoiceProfile[] = [],
): string {
  const title = sanitizeFilename(displayTitle(gen));
  const profile = resolveProfileForGeneration(gen, voiceProfiles);
  const artist = profile?.name?.trim() || gen.voice?.trim() || "";
  if (!artist) return title;
  return sanitizeFilename(`${title} — ${artist}`);
}

/** Open save dialog and write MP3 (or other format) with backend metadata when MP3. */
export async function promptExportGenerationAudio(
  gen: Generation,
  voiceProfiles: TtsVoiceProfile[] = [],
): Promise<boolean> {
  if (gen.status !== "done" || !gen.file_path?.trim()) {
    return false;
  }

  const dest = await save({
    defaultPath: `${mp3ExportDefaultStem(gen, voiceProfiles)}.mp3`,
    filters: [
      { name: "MP3 z okładką i tytułem", extensions: ["mp3"] },
      { name: "Inne audio", extensions: ["wav", "ogg"] },
    ],
  });
  if (!dest) return false;

  await exportGenerationToPath(gen.id, dest);
  return true;
}

/** MP4: static cover + audio + title overlay — WhatsApp shows video preview. */
export async function promptExportGenerationMp4(
  gen: Generation,
  voiceProfiles: TtsVoiceProfile[] = [],
): Promise<boolean> {
  if (gen.status !== "done" || !gen.file_path?.trim()) {
    return false;
  }

  const dest = await save({
    defaultPath: `${mp3ExportDefaultStem(gen, voiceProfiles)}.mp4`,
    filters: [{ name: "MP4 wideo (WhatsApp)", extensions: ["mp4"] }],
  });
  if (!dest) return false;

  await exportGenerationMp4ToPath(gen.id, dest);
  return true;
}
