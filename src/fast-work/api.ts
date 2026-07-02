import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  FastWorkExportResult,
  FastWorkGeneration,
  FastWorkSettingsView,
} from "../fast-work/types";

export async function fastWorkGenerate(text: string): Promise<FastWorkGeneration> {
  return invoke<FastWorkGeneration>("fast_work_generate", { req: { text } });
}

export async function fastWorkListSessionHistory(): Promise<FastWorkGeneration[]> {
  return invoke<FastWorkGeneration[]>("fast_work_list_session_history");
}

export async function fastWorkGetSettings(): Promise<FastWorkSettingsView> {
  return invoke<FastWorkSettingsView>("fast_work_get_settings");
}

export async function fastWorkSetShortcut(
  shortcut: string | null,
): Promise<FastWorkSettingsView> {
  return invoke<FastWorkSettingsView>("fast_work_set_shortcut", {
    update: { shortcut },
  });
}

export async function fastWorkPickOutputFolder(): Promise<string | null> {
  return invoke<string | null>("fast_work_pick_output_folder");
}

export async function fastWorkNewOutputFolder(): Promise<string> {
  return invoke<string>("fast_work_new_output_folder");
}

export async function fastWorkOpenOutputFolder(): Promise<void> {
  return invoke("fast_work_open_output_folder");
}

export async function fastWorkRevealFile(path: string): Promise<void> {
  return invoke("fast_work_reveal_file", { path });
}

export async function fastWorkProbeMinimax(): Promise<{ ok: boolean; message?: string }> {
  return invoke("fast_work_probe_minimax");
}

export async function exportFastWorkPortable(
  profileId: string,
  destParentDir: string,
  shortcut?: string | null,
): Promise<FastWorkExportResult> {
  return invoke<FastWorkExportResult>("export_fast_work_portable", {
    req: {
      profileId,
      destParentDir,
      shortcut: shortcut ?? null,
    },
  });
}

export async function pickFastWorkExportFolder(): Promise<string | null> {
  return invoke<string | null>("pick_fast_work_export_folder");
}

export function fastWorkAudioSrc(filePath: string): string {
  return convertFileSrc(filePath);
}

export function onFastWorkGenerated(
  handler: (gen: FastWorkGeneration) => void,
): Promise<() => void> {
  return listen<FastWorkGeneration>("fast-work:generated", (e) => handler(e.payload));
}

export function onFastWorkError(handler: (message: string) => void): Promise<() => void> {
  return listen<string>("fast-work:error", (e) => handler(e.payload));
}
