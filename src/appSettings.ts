import type { AudioFormat } from "./types";
import type { MinimaxProviderSettings, MinimaxSynthesisOptions } from "./lib/minimaxOptions";
import type { TextFiltersSettings } from "./lib/textFiltersTypes";
import {
  DEFAULT_TIMELINE_VIEW,
  normalizeTimelineViewMode,
  type TimelineViewMode,
} from "./lib/timelineView";

export type { TimelineViewMode };

export type {
  BuiltinFilterToggles,
  CustomTextFilter,
  TextFilterPreset,
  TextFiltersSettings,
  BuiltinFilterOverrides,
} from "./lib/textFiltersTypes";
export {
  DEFAULT_BUILTIN_TOGGLES,
  defaultTextFiltersSettings,
  newCustomFilter,
  newTextFilterPreset,
  resolveActivePreset,
} from "./lib/textFiltersTypes";

export type SaveMode = "manual" | "auto";

export type TtsProviderId = "google" | "voicebox" | "minimax";
export type VoiceboxServerMode = "external" | "bundled" | "disabled";

export const ALL_TTS_PROVIDERS: TtsProviderId[] = ["google", "voicebox", "minimax"];

export interface ApiProfile {
  id: string;
  name: string;
  api_key: string;
}

export interface CursorIntegration {
  enabled: boolean;
  autoplay: boolean;
  max_sentences: number;
  provider: string;
  model: string;
  voice: string;
  style: string | null;
  format: string | null;
  profile_id: string | null;
  language: string | null;
  engine: string | null;
  minimax_speed: number | null;
  minimax_vol: number | null;
  minimax_pitch: number | null;
  minimax_options?: MinimaxSynthesisOptions | null;
  use_summary_markers: boolean;
  dnd_until_ts: number | null;
  last_install_ts: number | null;
}

export function defaultCursorIntegration(): CursorIntegration {
  return {
    enabled: false,
    autoplay: true,
    max_sentences: 10,
    provider: "minimax",
    model: "speech-2.8-hd",
    voice: "Polish_female_1_sample1",
    style: null,
    format: "mp3",
    profile_id: null,
    language: "pl",
    engine: null,
    minimax_speed: 1,
    minimax_vol: 1,
    minimax_pitch: 0,
    use_summary_markers: true,
    dnd_until_ts: null,
    last_install_ts: null,
  };
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
  output_vol?: number | null;
}

export interface VoiceProfileSpeaker {
  speaker: string;
  voice: string;
}

/** Zapisany zestaw parametrów TTS (provider, model, głos, styl itd.). */
export interface TtsVoiceProfile {
  id: string;
  name: string;
  provider: string;
  model: string;
  voice: string;
  style: string | null;
  /** Voice Box — id profilu serwera. */
  profile_id: string | null;
  language: string | null;
  engine: string | null;
  /** Voice Box — włącz przepisywanie tekstu w charakterze (personality). */
  personality_enabled?: boolean | null;
  minimax_speed: number | null;
  minimax_vol: number | null;
  minimax_pitch: number | null;
  minimax_options?: MinimaxSynthesisOptions | null;
  multi_speaker: boolean;
  speakers: VoiceProfileSpeaker[];
  /** Jedna linia ostatniego tekstu wygenerowanego tym profilem. */
  last_preview?: string | null;
  last_preview_at?: number | null;
  /** Skrót szybkiej generacji (synchronizowany z quick_hotkeys). */
  shortcut?: string | null;
  shortcut_enabled?: boolean;
}

export interface QuickHotkeyPreset {
  id: string;
  enabled: boolean;
  name: string;
  shortcut: string;
  provider: string;
  model: string;
  voice: string;
  style: string | null;
  profile_id: string | null;
  language: string | null;
  engine: string | null;
  minimax_speed: number | null;
  minimax_vol: number | null;
  minimax_pitch: number | null;
  minimax_options?: MinimaxSynthesisOptions | null;
  load_editor: boolean;
  autoplay: boolean;
  filter_preset_id: string | null;
  format: string | null;
  /** Odwołanie do zapisanego profilu głosu (`voice_profiles`). */
  voice_profile_id?: string | null;
}

export interface QuickHotkeysSettings {
  enabled: boolean;
  presets: QuickHotkeyPreset[];
}

export function defaultQuickHotkeyPreset(name = "Szybki TTS"): QuickHotkeyPreset {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    name,
    shortcut: "Ctrl+Alt+1",
    provider: "google",
    model: "gemini-2.5-flash-preview-tts",
    voice: "Kore",
    style: "Powiedz spokojnie po polsku:",
    profile_id: null,
    language: "pl",
    engine: null,
    minimax_speed: 1,
    minimax_vol: 1,
    minimax_pitch: 0,
    load_editor: false,
    autoplay: true,
    filter_preset_id: null,
    format: null,
    voice_profile_id: null,
  };
}

export function defaultQuickHotkeysSettings(): QuickHotkeysSettings {
  return {
    enabled: false,
    presets: [defaultQuickHotkeyPreset()],
  };
}

/** Slot szybkiej generacji z paska edytora (Gen Ust 1 / 2). */
export interface EditorQuickGenSlot {
  label: string;
  provider: string;
  model: string;
  voice: string;
  style: string | null;
  profile_id: string | null;
  language: string | null;
  engine: string | null;
  minimax_speed: number | null;
  minimax_vol: number | null;
  minimax_pitch: number | null;
  minimax_options?: MinimaxSynthesisOptions | null;
  filter_preset_id: string | null;
  format: string | null;
  voice_profile_id?: string | null;
}

export interface EditorQuickGenSettings {
  slot1: EditorQuickGenSlot;
  slot2: EditorQuickGenSlot;
}

export function defaultEditorQuickGenSlot(label: string): EditorQuickGenSlot {
  return {
    label,
    provider: "google",
    model: "gemini-2.5-flash-preview-tts",
    voice: "Kore",
    style: "Powiedz spokojnie po polsku:",
    profile_id: null,
    language: "pl",
    engine: null,
    minimax_speed: 1,
    minimax_vol: 1,
    minimax_pitch: 0,
    filter_preset_id: null,
    format: null,
    voice_profile_id: null,
  };
}

export function defaultEditorQuickGenSettings(): EditorQuickGenSettings {
  return {
    slot1: defaultEditorQuickGenSlot("Gen Ust 1"),
    slot2: defaultEditorQuickGenSlot("Gen Ust 2"),
  };
}

/** Mapowanie widoku ustawień na payload zapisu (wszystkie pola AppSettings). */
export function appSettingsViewToPayload(view: AppSettingsView): AppSettings {
  return {
    save_mode: view.save_mode,
    save_format: view.save_format,
    temp_path: view.temp_path,
    archive_path: view.archive_path,
    api_profiles: view.api_profiles,
    active_api_id: view.active_api_id,
    cursor_integration: view.cursor_integration,
    max_concurrent_jobs: view.max_concurrent_jobs,
    active_skin_id: view.active_skin_id,
    skin_registry_urls: view.skin_registry_urls ?? [],
    text_filters: view.text_filters,
    minimax_cloned_voices: view.minimax_cloned_voices,
    minimax_synced_voices: view.minimax_synced_voices,
    minimax_voices_synced_at: view.minimax_voices_synced_at ?? null,
    quick_hotkeys: view.quick_hotkeys,
    editor_quick_gen: view.editor_quick_gen ?? defaultEditorQuickGenSettings(),
    voice_profiles: view.voice_profiles ?? [],
    reroute_voice_profile_id: view.reroute_voice_profile_id ?? null,
    quick_setup_completed: view.quick_setup_completed,
    ui_tutorial_completed: view.ui_tutorial_completed,
    enabled_providers: view.enabled_providers,
    minimax_enabled_languages: view.minimax_enabled_languages,
    voicebox_base_url: view.voicebox_base_url ?? null,
    voicebox_server_mode: view.voicebox_server_mode ?? "external",
    minimax_api_key: view.minimax_api_key ?? null,
    minimax_provider_settings: view.minimax_provider_settings,
    temp_history_max: view.temp_history_max ?? DEFAULT_TEMP_HISTORY_MAX,
    quick_history_page_size: view.quick_history_page_size ?? DEFAULT_QUICK_HISTORY_PAGE_SIZE,
    timeline_view: normalizeTimelineViewMode(view.timeline_view),
    safe_mode: view.safe_mode ?? false,
    safe_mode_auto_open_queue: view.safe_mode_auto_open_queue ?? true,
    default_video_template_id: view.default_video_template_id ?? "builtin-whatsapp-karaoke",
    auto_archive_mp4_on_clipboard: view.auto_archive_mp4_on_clipboard ?? true,
  };
}

export interface AppSettings {
  save_mode: SaveMode;
  save_format: AudioFormat;
  temp_path: string | null;
  archive_path: string | null;
  api_profiles: ApiProfile[];
  active_api_id: string | null;
  cursor_integration: CursorIntegration;
  max_concurrent_jobs: number;
  active_skin_id: string;
  skin_registry_urls: string[];
  text_filters?: TextFiltersSettings;
  minimax_cloned_voices?: MinimaxClonedVoice[];
  minimax_synced_voices?: MinimaxPresetVoice[];
  minimax_voices_synced_at?: number | null;
  quick_hotkeys?: QuickHotkeysSettings;
  editor_quick_gen?: EditorQuickGenSettings;
  voice_profiles?: TtsVoiceProfile[];
  /** Gdy ustawione — wszystkie żądania generacji (poza roleplay / skrótami) idą tym profilem. */
  reroute_voice_profile_id?: string | null;
  quick_setup_completed?: boolean;
  /** First-run interactive tutorial (Quick Setup → TTS tour → README summary). */
  ui_tutorial_completed?: boolean;
  enabled_providers?: TtsProviderId[];
  /** Hub codes (`pl`, `en`). Empty = all catalog languages. */
  minimax_enabled_languages?: string[];
  voicebox_base_url?: string | null;
  /** external (default) | bundled (TTS Hub spawns fork) | disabled */
  voicebox_server_mode?: VoiceboxServerMode;
  minimax_api_key?: string | null;
  minimax_provider_settings?: MinimaxProviderSettings;
  /** Max temp history from prior app sessions; current session always kept in full. */
  temp_history_max?: number;
  /** Initial row count (and load-more step) for sidebar "Ostatnie generacje". */
  quick_history_page_size?: number;
  /** Main playback bar waveform style: bars | bars-detailed | line */
  timeline_view?: TimelineViewMode;
  /** Hold new generations for manual approval before synthesis. */
  safe_mode?: boolean;
  /** Expand queue panel and show approval tab when a new pending item arrives. */
  safe_mode_auto_open_queue?: boolean;
  default_video_template_id?: string | null;
  auto_archive_mp4_on_clipboard?: boolean;
}

export { DEFAULT_TIMELINE_VIEW };

export const DEFAULT_MINIMAX_LANGUAGE = "pl";
export const DEFAULT_MINIMAX_VOICE_ID = "Polish_female_1_sample1";

export const MIN_CONCURRENT_JOBS = 1;
export const MAX_CONCURRENT_JOBS = 8;
export const DEFAULT_MAX_CONCURRENT_JOBS = 3;

export const MIN_TEMP_HISTORY_MAX = 10;
export const MAX_TEMP_HISTORY_MAX = 500;
export const DEFAULT_TEMP_HISTORY_MAX = 100;

export const MIN_QUICK_HISTORY_PAGE_SIZE = 5;
export const MAX_QUICK_HISTORY_PAGE_SIZE = 100;
export const DEFAULT_QUICK_HISTORY_PAGE_SIZE = 30;

export interface CursorIntegrationStatus {
  api_ok: boolean;
  hooks_installed: boolean;
  ps1_path: string;
  hooks_json_path: string;
  tts_hub_config_path: string;
  pwsh_available: boolean;
  last_install_ts: number | null;
  last_cursor_at: number | null;
}

export interface McpIntegrationStatus {
  configured: boolean;
  config_path: string | null;
  scope: "global" | "workspace" | null;
}

export interface AppBuildInfo {
  version: string;
  git_hash: string | null;
}

export interface CursorInstallReport {
  copied_ps1: string;
  hooks_json: string;
  hooks_json_backup: string | null;
  tts_hub_config: string;
  ts: number;
}

export interface AppSettingsView extends AppSettings {
  effective_temp_path: string;
  effective_archive_path: string;
  env_api_key_available: boolean;
  env_minimax_api_key_available: boolean;
  effective_voicebox_url: string;
  env_voicebox_url: string;
  effective_minimax_configured: boolean;
}

export function isProviderEnabled(
  enabled: TtsProviderId[] | undefined,
  id: TtsProviderId,
): boolean {
  if (!enabled || enabled.length === 0) return true;
  return enabled.includes(id);
}

export function newApiProfile(name = "Profil API", apiKey = ""): ApiProfile {
  return {
    id: crypto.randomUUID(),
    name,
    api_key: apiKey,
  };
}
