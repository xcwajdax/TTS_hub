export type AudioFormat = "wav" | "mp3" | "ogg";

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
  autoplay?: boolean;
  source?: GenerationSource;
  conversation_id?: string | null;
  summary_text?: string | null;
}

export type GenerationSource = "manual" | "http" | "cursor";

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
}

export type HistoryScope = "session" | "archive";

export type JobScope = "active" | "interrupted" | "failed" | "all";
