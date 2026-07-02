import type { TextFilterPreset } from "./lib/textFiltersTypes";
import type { MinimaxSynthesisOptions } from "./lib/minimaxOptions";

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
  minimax_options?: MinimaxSynthesisOptions | null;
  // === voice-profile attribution (2026-06-09) — optional ===
  // Id of the saved TtsVoiceProfile used for this generation. When set,
  // the backend stores it on `generations.voice_profile_id` (and, if a chat
  // session is attached, on `chat_messages.voice_profile_id` too) so the
  // history items and chat bubbles can render the profile avatar/name.
  voice_profile_id?: string | null;
  /** Optional project/session label (badge in history; title unchanged). */
  context_label?: string | null;
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
  | "cancelled"
  | "pending_approval"
  | "rejected";

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
  // === origin attribution (2026-06-07) — optional, populated by external ===
  // === callers (Telegram bot, future Discord/WhatsApp bots) that POST to ===
  // === /generate with an `origin` block. NULL for desktop-originated ===
  // === generations. Free-form kind: "telegram" | "discord" | "webhook" | ===
  // === "cli" | "desktop". ===
  origin_kind?: string | null;
  origin_platform_id?: string | null;
  origin_user_id?: string | null;
  origin_user_name?: string | null;
  origin_thread_id?: string | null;
  // === voice-profile attribution (2026-06-09) — optional ===
  // Snapshot of the saved TtsVoiceProfile id at generation time. The history
  // UI resolves it against `appSettings.voice_profiles` to render a
  // `<VoiceProfileBadge>` (avatar + name). When null, the UI falls back to
  // fuzzy matching on (provider, model, voice) — or to a bare "voice" label.
  voice_profile_id?: string | null;
  context_label?: string | null;
  is_private?: boolean;
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

export type HistoryScope = "session" | "archive" | "cursor" | "bots";

export type JobScope = "active" | "interrupted" | "failed" | "pending_approval" | "all";
