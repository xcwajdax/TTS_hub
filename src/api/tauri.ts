import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AppSettingsView,
  CursorIntegration,
  CursorIntegrationStatus,
  CursorInstallReport,
} from "../appSettings";
import type {
  ArchiveFolder,
  ArchiveTag,
  AudioFormat,
  FolderFilterId,
  FolderRule,
  FolderRuleInput,
  GenerateRequest,
  Generation,
  HistoryScope,
  JobScope,
  UsageSummary,
} from "../types";
import type { TtsModelInfo } from "../ttsModels";
import type { PluginManifest, SoundboardPublicView } from "../plugins/types";

/** Enqueue a generation. Returns the persisted row with status='queued'. */
export async function generate(req: GenerateRequest): Promise<Generation> {
  return invoke<Generation>("generate", { req });
}

export async function listHistory(
  scope: HistoryScope,
  folderId?: FolderFilterId | null,
): Promise<Generation[]> {
  return invoke<Generation[]>("list_history", {
    scope,
    folderId: folderId ?? null,
  });
}

export async function listFolders(): Promise<ArchiveFolder[]> {
  return invoke<ArchiveFolder[]>("list_folders");
}

export async function listTags(): Promise<ArchiveTag[]> {
  return invoke<ArchiveTag[]>("list_tags");
}

export async function createTag(name: string, color?: string | null): Promise<ArchiveTag> {
  return invoke<ArchiveTag>("create_tag", { name, color: color ?? null });
}

export async function renameTag(id: string, newName: string): Promise<ArchiveTag> {
  return invoke<ArchiveTag>("rename_tag", { id, newName });
}

export async function deleteTag(id: string): Promise<void> {
  return invoke("delete_tag", { id });
}

export async function setGenerationTags(
  generationId: string,
  tagIds: string[],
): Promise<Generation> {
  return invoke<Generation>("set_generation_tags", { generationId, tagIds });
}

export async function createFolder(name: string, color?: string | null): Promise<ArchiveFolder> {
  return invoke<ArchiveFolder>("create_folder", { name, color: color ?? null });
}

export async function renameFolder(id: string, newName: string): Promise<ArchiveFolder> {
  return invoke<ArchiveFolder>("rename_folder", { id, newName });
}

export async function deleteFolder(id: string, mode: "unassign" | "delete_items"): Promise<void> {
  return invoke("delete_folder", { id, mode });
}

export async function moveToFolder(
  generationId: string,
  folderId: string | null,
): Promise<Generation> {
  return invoke<Generation>("move_to_folder", { generationId, folderId });
}

export async function listFolderRules(): Promise<FolderRule[]> {
  return invoke<FolderRule[]>("list_folder_rules");
}

export async function upsertFolderRule(rule: FolderRuleInput): Promise<FolderRule> {
  return invoke<FolderRule>("upsert_folder_rule", { rule });
}

export async function deleteFolderRule(id: string): Promise<void> {
  return invoke("delete_folder_rule", { id });
}

export async function getTokenUsage(): Promise<UsageSummary> {
  return invoke<UsageSummary>("get_token_usage");
}

export async function listJobs(scope: JobScope): Promise<Generation[]> {
  return invoke<Generation[]>("list_jobs", { scope });
}

export async function cancelJob(id: string): Promise<void> {
  return invoke("cancel_job", { id });
}

export async function resumeJob(id: string): Promise<Generation> {
  return invoke<Generation>("resume_job", { id });
}

export async function discardJob(id: string): Promise<void> {
  return invoke("discard_job", { id });
}

export async function resumeAllInterrupted(): Promise<Generation[]> {
  return invoke<Generation[]>("resume_all_interrupted");
}

export async function discardAllInterrupted(): Promise<number> {
  return invoke<number>("discard_all_interrupted");
}

export async function archiveGeneration(id: string, format: AudioFormat): Promise<Generation> {
  return invoke<Generation>("archive_generation", { id, format });
}

export async function updateGenerationTitle(id: string, title: string): Promise<Generation> {
  return invoke<Generation>("update_generation_title", { id, title });
}

export async function updateGenerationUiColor(
  id: string,
  uiColor: string | null,
): Promise<Generation> {
  return invoke<Generation>("update_generation_ui_color", { id, uiColor });
}

export async function deleteGeneration(id: string): Promise<void> {
  return invoke("delete_generation", { id });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function exportGenerationToPath(id: string, destPath: string): Promise<void> {
  return invoke("export_generation_to_path", { id, destPath });
}

export async function revealInExplorer(path: string): Promise<void> {
  return invoke("reveal_in_explorer", { path });
}

export async function copyGenerationAudioToClipboard(id: string): Promise<void> {
  return invoke("copy_generation_audio_to_clipboard", { id });
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

export interface ClearLocalDataResult {
  removedGenerations: number;
  bytesRemoved: number;
}

export async function getClearLocalDataConfirmationWord(): Promise<string> {
  return invoke<string>("get_clear_local_data_confirmation_word");
}

export async function clearLocalAppData(confirmation: string): Promise<ClearLocalDataResult> {
  return invoke<ClearLocalDataResult>("clear_local_app_data", { confirmation });
}

export async function getAppSettings(): Promise<AppSettingsView> {
  return invoke<AppSettingsView>("get_app_settings");
}

export async function setAppSettings(settings: AppSettings): Promise<AppSettingsView> {
  return invoke<AppSettingsView>("set_app_settings", { settings });
}

export interface ProbeResult {
  ok: boolean;
  message: string;
  model_count?: number;
}

export async function probeGoogle(apiKey: string): Promise<ProbeResult> {
  return invoke<ProbeResult>("probe_google", { apiKey });
}

export async function probeVoicebox(baseUrl: string): Promise<ProbeResult> {
  return invoke<ProbeResult>("probe_voicebox", { baseUrl });
}

export async function probeMinimax(apiKey: string): Promise<ProbeResult> {
  return invoke<ProbeResult>("probe_minimax", { apiKey });
}

export async function openQuickSetupWindow(): Promise<void> {
  return invoke("open_quick_setup_window");
}

export async function closeQuickSetupWindow(): Promise<void> {
  return invoke("close_quick_setup_window");
}

export async function testQuickHotkeyPreset(presetId: string): Promise<Generation> {
  return invoke<Generation>("test_quick_hotkey_preset", { presetId });
}

export async function listVoices(): Promise<string[]> {
  return invoke<string[]>("list_voices");
}

export async function listModels(): Promise<TtsModelInfo[]> {
  return invoke<TtsModelInfo[]>("list_models");
}

export interface VoiceBoxHealth {
  status: string;
  model_loaded: boolean;
  model_downloaded: boolean | null;
  model_size: string | null;
  gpu_available: boolean;
  gpu_type: string | null;
  vram_used_mb: number | null;
  backend_type: string | null;
  backend_variant: string | null;
  gpu_compatibility_warning: string | null;
}

export interface VoiceBoxProfile {
  id: string;
  name: string;
  description: string | null;
  language: string;
  default_engine: string | null;
  personality: string | null;
  generation_count: number;
  sample_count: number;
}

export async function voiceboxHealth(): Promise<VoiceBoxHealth> {
  return invoke<VoiceBoxHealth>("voicebox_health");
}

export async function listVoiceboxProfiles(): Promise<VoiceBoxProfile[]> {
  return invoke<VoiceBoxProfile[]>("list_voicebox_profiles");
}

export async function listVoiceboxModels(): Promise<TtsModelInfo[]> {
  return invoke<TtsModelInfo[]>("list_voicebox_models");
}

export interface MinimaxHealth {
  configured: boolean;
  ok: boolean;
  message: string;
}

export interface MinimaxModelInfo {
  id: string;
  display_name: string;
}

export interface MinimaxLanguageInfo {
  code: string;
  language_boost: string;
  display_name: string;
}

export interface MinimaxPresetVoice {
  voice_id: string;
  display_name: string;
  language: string;
}

export interface MinimaxClonedVoice {
  voice_id: string;
  name: string;
  created_at: number;
}

export interface MinimaxSyncVoicesResult {
  system_count: number;
  cloning_count: number;
  generation_count: number;
  synced_at: number;
}

export async function minimaxHealth(): Promise<MinimaxHealth> {
  return invoke<MinimaxHealth>("minimax_health");
}

export function listMinimaxModels(): Promise<MinimaxModelInfo[]> {
  return invoke<MinimaxModelInfo[]>("list_minimax_models");
}

export function listMinimaxLanguages(): Promise<MinimaxLanguageInfo[]> {
  return invoke<MinimaxLanguageInfo[]>("list_minimax_languages");
}

export function listMinimaxPresetVoices(): Promise<MinimaxPresetVoice[]> {
  return invoke<MinimaxPresetVoice[]>("list_minimax_preset_voices");
}

export async function listMinimaxClonedVoices(): Promise<MinimaxClonedVoice[]> {
  return invoke<MinimaxClonedVoice[]>("list_minimax_cloned_voices");
}

export async function syncMinimaxVoices(): Promise<MinimaxSyncVoicesResult> {
  return invoke<MinimaxSyncVoicesResult>("sync_minimax_voices");
}

export async function minimaxCloneVoice(params: {
  sourcePath: string;
  voiceId: string;
  name: string;
  model: string;
  previewText: string;
  promptPath?: string | null;
  promptText?: string | null;
}): Promise<MinimaxClonedVoice> {
  return invoke<MinimaxClonedVoice>("minimax_clone_voice", {
    source_path: params.sourcePath,
    voice_id: params.voiceId,
    name: params.name,
    model: params.model,
    preview_text: params.previewText,
    prompt_path: params.promptPath ?? null,
    prompt_text: params.promptText ?? null,
  });
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

export interface SkinListEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  source: "builtin" | "custom";
  dir_path?: string;
}

export interface SkinManifestPayload {
  id: string;
  name: string;
  version: string;
  author: string;
  extends?: string;
  tokens?: Record<string, string>;
  css?: string;
  icons?: { filter?: string; variant?: string };
  registry?: {
    homepage?: string;
    update_url?: string;
    manifest_url?: string;
  };
}

export interface CustomSkinLoaded {
  manifest: SkinManifestPayload;
  dir_path: string;
  css_text?: string;
}

export async function listCustomSkins(): Promise<SkinListEntry[]> {
  return invoke<SkinListEntry[]>("list_custom_skins");
}

export async function readCustomSkin(skinId: string): Promise<CustomSkinLoaded> {
  return invoke<CustomSkinLoaded>("read_custom_skin", { skinId });
}

export async function installSkinArchive(
  archivePath: string,
  overwrite = false,
): Promise<string> {
  return invoke<string>("install_skin_archive", { archivePath, overwrite });
}

export async function exportSkin(skinId: string, destPath: string): Promise<void> {
  return invoke("export_skin", { skinId, destPath });
}

export async function openSkinsFolder(): Promise<void> {
  return invoke("open_skins_folder");
}

export async function pickSkinArchive(): Promise<string | null> {
  return invoke<string | null>("pick_skin_archive");
}

export async function pickSkinExportPath(skinId: string): Promise<string | null> {
  return invoke<string | null>("pick_skin_export_path", { skinId });
}

export type AvatarInfo = {
  exists: boolean;
  path: string | null;
};

export async function readImageFileBase64(path: string): Promise<string> {
  return invoke<string>("read_image_file_base64", { path });
}

export async function listSourceAvatars(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("list_source_avatars");
}

export async function getSourceAvatar(source: string): Promise<AvatarInfo> {
  return invoke<AvatarInfo>("get_source_avatar", { source });
}

export async function getVoiceAvatar(provider: string, voiceId: string): Promise<AvatarInfo> {
  return invoke<AvatarInfo>("get_voice_avatar", { provider, voiceId });
}

export async function saveSourceAvatar(source: string, imageBase64: string): Promise<string> {
  return invoke<string>("save_source_avatar", { source, imageBase64 });
}

export async function saveVoiceAvatar(
  provider: string,
  voiceId: string,
  imageBase64: string,
): Promise<string> {
  return invoke<string>("save_voice_avatar", { provider, voiceId, imageBase64 });
}

export async function deleteSourceAvatar(source: string): Promise<void> {
  return invoke("delete_source_avatar", { source });
}

export async function deleteVoiceAvatar(provider: string, voiceId: string): Promise<void> {
  return invoke("delete_voice_avatar", { provider, voiceId });
}

export async function pickAvatarImage(): Promise<string | null> {
  return invoke<string | null>("pick_avatar_image");
}

export async function openAvatarsFolder(): Promise<void> {
  return invoke("open_avatars_folder");
}

export async function getPlugins(): Promise<PluginManifest[]> {
  return invoke<PluginManifest[]>("get_plugins");
}

export async function installPlugin(id: string): Promise<PluginManifest[]> {
  return invoke<PluginManifest[]>("install_plugin", { id });
}

export async function uninstallPlugin(id: string): Promise<PluginManifest[]> {
  return invoke<PluginManifest[]>("uninstall_plugin", { id });
}

export async function setPluginEnabled(
  id: string,
  enabled: boolean,
): Promise<PluginManifest[]> {
  return invoke<PluginManifest[]>("set_plugin_enabled", { id, req: { enabled } });
}

export async function setSoundboardEnabled(
  enabled: boolean,
): Promise<SoundboardPublicView> {
  return invoke<SoundboardPublicView>("set_soundboard_enabled", { req: { enabled } });
}

export async function getSoundboard(): Promise<SoundboardPublicView> {
  return invoke<SoundboardPublicView>("get_soundboard");
}

export async function setSoundboardSlot(
  index: number,
  body: { generationId?: string; filePath?: string },
): Promise<SoundboardPublicView> {
  return invoke<SoundboardPublicView>("set_soundboard_slot", { index, req: body });
}

export async function updateSoundboardSlot(
  index: number,
  body: { label?: string; shortcut?: string; enabled?: boolean },
): Promise<SoundboardPublicView> {
  return invoke<SoundboardPublicView>("update_soundboard_slot", { index, req: body });
}

export async function clearSoundboardSlot(index: number): Promise<SoundboardPublicView> {
  return invoke<SoundboardPublicView>("clear_soundboard_slot", { index });
}

export async function playSoundboardSlot(index: number): Promise<void> {
  return invoke("play_soundboard_slot", { index });
}

export async function appRestart(): Promise<void> {
  await invoke("app_restart");
}

export async function appExit(): Promise<void> {
  return invoke("app_exit");
}

/** WebView2: allow enumerateDevices() to return speaker IDs. */
export async function prepareAudioDeviceEnumeration(): Promise<void> {
  await invoke("prepare_audio_device_enumeration");
}

export interface NativeAudioOutputDevice {
  id: string;
  label: string;
}

/** Windows WASAPI list when Chromium enumerateDevices returns no outputs. */
export async function listNativeAudioOutputDevices(): Promise<NativeAudioOutputDevice[]> {
  return invoke<NativeAudioOutputDevice[]>("list_native_audio_output_devices");
}

/** Local HTTP API (see src-tauri http_api.rs). Reliable for <audio> in the Tauri webview. */
export const LOCAL_API_BASE = "http://127.0.0.1:8765";

export function audioSrc(filePath: string): string {
  return convertFileSrc(filePath);
}

export function playbackAudioSrc(generationId: string): string {
  return `${LOCAL_API_BASE}/audio/${encodeURIComponent(generationId)}`;
}
