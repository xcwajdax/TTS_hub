import { invoke } from "@tauri-apps/api/core";
import type {
  VideoExportRecord,
  VideoTemplate,
  VideoTemplateMeta,
} from "../types/videoTemplate";

export async function listVideoTemplates(): Promise<VideoTemplateMeta[]> {
  return invoke<VideoTemplateMeta[]>("list_video_templates");
}

export async function getVideoTemplate(id: string): Promise<VideoTemplate> {
  return invoke<VideoTemplate>("get_video_template", { id });
}

export async function saveVideoTemplate(template: VideoTemplate): Promise<VideoTemplate> {
  return invoke<VideoTemplate>("save_video_template", { template });
}

export async function deleteVideoTemplate(id: string): Promise<void> {
  return invoke("delete_video_template", { id });
}

export async function duplicateVideoTemplate(
  sourceId: string,
  name: string,
): Promise<VideoTemplate> {
  return invoke<VideoTemplate>("duplicate_video_template", {
    args: { sourceId, name },
  });
}

export async function newVideoTemplateFromPreset(
  preset: "whatsapp" | "portrait-916" | "landscape-169",
  name: string,
): Promise<VideoTemplate> {
  const presetId =
    preset === "portrait-916"
      ? "portrait-916"
      : preset === "landscape-169"
        ? "landscape-169"
        : "whatsapp";
  return invoke<VideoTemplate>("new_video_template_from_preset", {
    args: { preset: presetId, name },
  });
}

export async function previewVideoTemplateFrame(
  template: VideoTemplate,
): Promise<string> {
  const result = await invoke<{ path: string }>("preview_video_template_frame", { template });
  return result.path;
}

export async function listVideoExports(
  limit = 100,
  offset = 0,
): Promise<VideoExportRecord[]> {
  return invoke<VideoExportRecord[]>("list_video_exports", { limit, offset });
}

export async function deleteVideoExport(id: string): Promise<void> {
  return invoke("delete_video_export_by_id", { id });
}

export async function copyVideoExportToClipboard(id: string): Promise<void> {
  return invoke("copy_video_export_to_clipboard", { id });
}
