import type { TextFilterPreset } from "./lib/textFiltersTypes";

export type AudioFormat = "wav" | "mp3" | "ogg";
export type TtsProvider = "google" | "voicebox" | "minimax";

/** Any TTS model id returned by Google (list_models) or stored in history. */
export type TtsModel = string;

export interface SpeakerConfig {
  speaker: string;
  voice: string;
}

export interface GenerateRequest {
  text: string;
  model: TtsModel;
  voice: string;
  style?: string | null;
  format: AudioFormat;
  multi_speaker?: SpeakerConfig[] | null;
  provider?: TtsProvider;
  profile_id?: string | null;
  language?: string | null;
  engine?: string | null;
  personality?: boolean | null;
  autoplay?: boolean;
  source?: GenerationSource;
  conversation_id?: string | null;
  summary_text?: string | null;
  filtered_text?: string | null;
  filter_config?: TextFilterPreset | null;
  minimax_speed?: number | null;
  minimax_vol?: number | null;
  minimax_pitch?: number | null;
}

export type GenerationSource = "manual" | "http" | "cursor" | "cursor-skill" | "quick_hotkey";

export type FolderFilterId = string | "__all__" | "__none__";

export interface ArchiveFolder {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  sort_order: number;
  created_at: number;
}

export interface ArchiveTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  sort_order: number;
  created_at: number;
}

export interface FolderRule {
  id: string;
  folder_id: string;
  match_source: GenerationSource | "*";
  priority: number;
  enabled: boolean;
  created_at: number;
}

export interface FolderRuleInput {
  id?: string | null;
  folder_id: string;
  match_source: GenerationSource | "*";
  priority: number;
  enabled: boolean;
}

export type JobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "interrupted"
  | "cancelled";

export interface Generation {
  id: string;
  created_at: number;
  text: string;
  title: string | null;
  model: string;
  voice: string;
  style: string | null;
  format: AudioFormat;
  duration_ms: number | null;
  file_path: string;
  is_archived: boolean;
  session_id: string;
  source: GenerationSource;
  conversation_id: string | null;
  summary_text: string | null;
  status: JobStatus;
  error: string | null;
  attempts: number;
  updated_at: number;
  provider?: string | null;
  input_chars?: number | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  folder_id?: string | null;
  /** Manual override for history row accent (#RGB / #RRGGBB). Falls back to source color. */
  ui_color?: string | null;
  /** User-defined archive tags (archived rows only). */
  tag_ids?: string[];
}

export interface UsageTotals {
  generations_done: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_chars: number;
}

export interface UsageSummary {
  all_time: UsageTotals;
  current_session: UsageTotals;
}

export type HistoryScope = "session" | "archive" | "cursor";

export type JobScope = "active" | "interrupted" | "failed" | "all";
