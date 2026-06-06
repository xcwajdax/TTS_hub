/**
 * Frontend types for the chat-window feature (2026-06-06).
 * Mirrors `src-tauri/src/chat/types.rs` — keep in sync.
 */

export interface ChatSession {
  id: string;
  source: string;
  title: string | null;
  created_at: number;
  last_active_at: number;
  is_saved: boolean;
  message_count: number;
  metadata_json: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  generation_id: string | null;
  created_at: number;
  order_index: number;
}

export interface CreateSessionReq {
  source: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionReq {
  title?: string;
  is_saved?: boolean;
}

export interface AddMessageReq {
  role: "user" | "assistant" | "system";
  content: string;
  generation_id?: string;
}
