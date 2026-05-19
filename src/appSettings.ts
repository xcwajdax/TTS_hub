import type { AudioFormat } from "./types";

export type SaveMode = "manual" | "auto";

export interface ApiProfile {
  id: string;
  name: string;
  api_key: string;
}

export interface CursorIntegration {
  enabled: boolean;
  autoplay: boolean;
  max_sentences: number;
  model: string;
  voice: string;
  style: string | null;
  use_summary_markers: boolean;
  dnd_until_ts: number | null;
  last_install_ts: number | null;
}

export function defaultCursorIntegration(): CursorIntegration {
  return {
    enabled: false,
    autoplay: true,
    max_sentences: 10,
    model: "gemini-2.5-flash-preview-tts",
    voice: "Kore",
    style: "Powiedz spokojnie po polsku:",
    use_summary_markers: true,
    dnd_until_ts: null,
    last_install_ts: null,
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
}

export const MIN_CONCURRENT_JOBS = 1;
export const MAX_CONCURRENT_JOBS = 8;
export const DEFAULT_MAX_CONCURRENT_JOBS = 3;

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
}

export function newApiProfile(name = "Profil API", apiKey = ""): ApiProfile {
  return {
    id: crypto.randomUUID(),
    name,
    api_key: apiKey,
  };
}
