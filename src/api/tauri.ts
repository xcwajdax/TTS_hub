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
  /** Mnożnik głośności klonu (0–10), stosowany do presetowego minimax_vol. */
  output_vol?: number | null;
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

export async function setMinimaxClonedVoiceOutputVol(
  voiceId: string,
  outputVol: number,
): Promise<MinimaxClonedVoice> {
  return invoke<MinimaxClonedVoice>("set_minimax_cloned_voice_output_vol", {
    voice_id: voiceId,
    output_vol: outputVol,
  });
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

export interface RoleplayProjectSummary {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  status: string;
  segment_count: number;
}

export interface RoleplaySegment {
  id: string;
  project_id: string;
  order_index: number;
  text: string;
  voice_profile_id: string;
  color: string;
  generation_id?: string | null;
  status: string;
  retry_count?: number;
  error?: string | null;
}

export interface RoleplayProject {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  doc_json: string;
  palette_json: string;
  timeline_json: string;
  status: string;
  segments: RoleplaySegment[];
}

export interface SaveRoleplayProjectReq {
  id: string;
  name: string;
  doc_json: string;
  palette_json: string;
  timeline_json: string;
  status: string;
  segments: Array<{
    id: string;
    order_index: number;
    text: string;
    voice_profile_id: string;
    color: string;
  }>;
}

export interface RoleplayQueueProgress {
  project_id: string;
  total: number;
  done: number;
  current_segment_id: string | null;
  paused: boolean;
}

export async function roleplayListProjects(): Promise<RoleplayProjectSummary[]> {
  return invoke("roleplay_list_projects");
}

export async function roleplayCreateProject(name: string): Promise<RoleplayProject> {
  return invoke("roleplay_create_project", { name });
}

export async function roleplayLoadProject(id: string): Promise<RoleplayProject> {
  return invoke("roleplay_load_project", { id });
}

export async function roleplaySaveProject(req: SaveRoleplayProjectReq): Promise<RoleplayProject> {
  return invoke("roleplay_save_project", { req });
}

export async function roleplayDeleteProject(id: string): Promise<void> {
  return invoke("roleplay_delete_project", { id });
}

export async function roleplayUpdateTimeline(projectId: string, timelineJson: string): Promise<void> {
  return invoke("roleplay_update_timeline", { projectId, timelineJson });
}

export async function roleplayStartQueue(projectId: string): Promise<RoleplayQueueProgress> {
  return invoke("roleplay_start_queue", { projectId });
}

export async function roleplayPauseQueue(projectId: string): Promise<void> {
  return invoke("roleplay_pause_queue", { projectId });
}

export async function roleplayResumeQueue(projectId: string): Promise<void> {
  return invoke("roleplay_resume_queue", { projectId });
}

export async function roleplayCancelQueue(projectId: string): Promise<void> {
  return invoke("roleplay_cancel_queue", { projectId });
}

export async function roleplayGetQueueProgress(projectId: string): Promise<RoleplayQueueProgress> {
  return invoke("roleplay_get_queue_progress", { projectId });
}

export async function roleplayRegenerateSegment(
  projectId: string,
  segmentId: string,
): Promise<void> {
  return invoke("roleplay_regenerate_segment", { projectId, segmentId });
}

export async function roleplayImportAudio(projectId: string, sourcePath: string): Promise<string> {
  return invoke("roleplay_import_audio", { projectId, sourcePath });
}

export async function roleplayWriteMixWav(projectId: string, wavBase64: string): Promise<string> {
  return invoke("roleplay_write_mix_wav", { projectId, wavBase64 });
}

export async function roleplayExportMix(
  wavPath: string,
  destPath: string,
  format: string,
): Promise<string> {
  return invoke("roleplay_export_mix", { wavPath, destPath, format });
}

// === chat-window (2026-06-06) ===
import type {
  AddMessageReq,
  ChatMessage,
  ChatSession,
} from "../chat/types";

export async function chatCreateSession(
  source: string,
  title?: string,
): Promise<ChatSession> {
  return invoke<ChatSession>("chat_create_session", { source, title });
}

export async function chatListSessions(
  source?: string,
  savedOnly = false,
): Promise<ChatSession[]> {
  return invoke<ChatSession[]>("chat_list_sessions", { source, savedOnly });
}

export async function chatGetSession(id: string): Promise<ChatSession | null> {
  return invoke<ChatSession | null>("chat_get_session", { id });
}

export async function chatUpdateSession(
  id: string,
  title?: string | null,
  isSaved?: boolean,
): Promise<void> {
  return invoke<void>("chat_update_session", { id, title, isSaved });
}

export async function chatDeleteSession(id: string): Promise<void> {
  return invoke<void>("chat_delete_session", { id });
}

export async function chatListMessages(sessionId: string): Promise<ChatMessage[]> {
  return invoke<ChatMessage[]>("chat_list_messages", { sessionId });
}

export async function chatAddMessage(
  sessionId: string,
  req: AddMessageReq,
): Promise<ChatMessage> {
  return invoke<ChatMessage>("chat_add_message", { sessionId, ...req });
}

/** Returns the generation_id (audio file pointer) for a chat message. */
export async function chatReplayMessage(messageId: string): Promise<string> {
  return invoke<string>("chat_replay_message", { messageId });
}

export async function chatListRecentSources(): Promise<[string, number][]> {
  return invoke<[string, number][]>("chat_list_recent_sources");
}
