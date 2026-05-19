import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AppSettingsView,
  CursorIntegration,
  CursorIntegrationStatus,
  CursorInstallReport,
} from "../appSettings";
import type { AudioFormat, GenerateRequest, Generation, HistoryScope } from "../types";
import type { TtsModelInfo } from "../ttsModels";

export async function generate(req: GenerateRequest): Promise<Generation> {
  return invoke<Generation>("generate", { req });
}

export async function listHistory(scope: HistoryScope): Promise<Generation[]> {
  return invoke<Generation[]>("list_history", { scope });
}

export async function archiveGeneration(id: string, format: AudioFormat): Promise<Generation> {
  return invoke<Generation>("archive_generation", { id, format });
}

export async function updateGenerationTitle(id: string, title: string): Promise<Generation> {
  return invoke<Generation>("update_generation_title", { id, title });
}

export async function deleteGeneration(id: string): Promise<void> {
  return invoke("delete_generation", { id });
}

export async function revealInExplorer(path: string): Promise<void> {
  return invoke("reveal_in_explorer", { path });
}

export async function openArchiveFolder(): Promise<void> {
  return invoke("open_archive_folder");
}

export async function pickArchiveFolder(): Promise<string | null> {
  return invoke<string | null>("pick_archive_folder");
}

export async function pickArchiveFolderSettings(): Promise<string | null> {
  return invoke<string | null>("pick_archive_folder_save");
}

export async function pickTempFolder(): Promise<string | null> {
  return invoke<string | null>("pick_temp_folder");
}

export async function getAppSettings(): Promise<AppSettingsView> {
  return invoke<AppSettingsView>("get_app_settings");
}

export async function setAppSettings(settings: AppSettings): Promise<AppSettingsView> {
  return invoke<AppSettingsView>("set_app_settings", { settings });
}

export async function listVoices(): Promise<string[]> {
  return invoke<string[]>("list_voices");
}

export async function listModels(): Promise<TtsModelInfo[]> {
  return invoke<TtsModelInfo[]>("list_models");
}

export interface VoiceSampleInfo {
  voice: string;
  ready: boolean;
}

export async function listVoiceSamples(model: string): Promise<VoiceSampleInfo[]> {
  return invoke<VoiceSampleInfo[]>("list_voice_samples", { model });
}

export async function ensureVoiceSample(model: string, voice: string): Promise<string> {
  return invoke<string>("ensure_voice_sample", { model, voice });
}

export async function generateAllVoiceSamples(model: string): Promise<VoiceSampleInfo[]> {
  return invoke<VoiceSampleInfo[]>("generate_all_voice_samples", { model });
}

export async function getSessionId(): Promise<string> {
  return invoke<string>("get_session_id");
}

export async function getCursorIntegrationStatus(): Promise<CursorIntegrationStatus> {
  return invoke<CursorIntegrationStatus>("get_cursor_integration_status");
}

export async function installCursorHooks(): Promise<CursorInstallReport> {
  return invoke<CursorInstallReport>("install_cursor_hooks");
}

export async function uninstallCursorHooks(
  removeScript: boolean,
  removeConfig: boolean,
): Promise<unknown> {
  return invoke("uninstall_cursor_hooks", {
    removeScript,
    removeConfig,
  });
}

export async function setCursorIntegration(cfg: CursorIntegration): Promise<CursorIntegration> {
  return invoke<CursorIntegration>("set_cursor_integration", { cfg });
}

export async function setCursorDnd(minutes: number): Promise<number | null> {
  return invoke<number | null>("set_cursor_dnd", { minutes });
}

export async function exportCursorHookConfig(): Promise<string> {
  return invoke<string>("export_cursor_hook_config");
}

/** Local HTTP API (see src-tauri http_api.rs). Reliable for <audio> in the Tauri webview. */
export const LOCAL_API_BASE = "http://127.0.0.1:8765";

export function audioSrc(filePath: string): string {
  return convertFileSrc(filePath);
}

export function playbackAudioSrc(generationId: string): string {
  return `${LOCAL_API_BASE}/audio/${encodeURIComponent(generationId)}`;
}
