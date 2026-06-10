/**
 * ChatView — 4th tab in AppViewTabs.
 *
 * Lists chat sessions (per source), shows messages of the active session.
 * Reuses the existing PlaybackContext to play message audio via
 * `chatReplayMessage` (which returns the generation_id, then the audio
 * URL is built with `playbackAudioSrc(generation_id)`).
 *
 * Subscribes to Tauri events `chat:session_changed` and `chat:message_added`
 * for live updates from the backend.
 */

import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import * as api from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import VoiceProfileBadge from "../components/VoiceProfileBadge";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import type { ChatMessage, ChatSession } from "./types";
import { getAppSettings } from "../api/tauri";

interface Props {
  onError: (msg: string | null) => void;
  onToast: (msg: string | null) => void;
  /** Saved voice profiles. If omitted, ChatView loads them itself. */
  voiceProfiles?: TtsVoiceProfile[];
}

export default function ChatView({ onError, onToast, voiceProfiles: voiceProfilesProp }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSource, setNewSource] = useState("hermes");
  // Saved voice profiles — used to render the badge in the bubble header.
  // We re-load on `VOICE_PROFILES_CHANGED` so renames/edits propagate
  // immediately without the user having to switch sessions.
  const [voiceProfilesState, setVoiceProfilesState] = useState<TtsVoiceProfile[]>(
    () => voiceProfilesProp ?? [],
  );
  const voiceProfiles = voiceProfilesProp ?? voiceProfilesState;
  useEffect(() => {
    if (voiceProfilesProp) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const view = await getAppSettings();
        if (!cancelled) setVoiceProfilesState(view.voice_profiles ?? []);
      } catch {
        // ignore — badges simply won't render
      }
    };
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_PROFILES_CHANGED, onChange);
    };
  }, [voiceProfilesProp]);
  // Map messageId → resolved profile (for bubbles that carry
  // `voice_profile_id`). Memoised to keep referential stability.
  const profileByMessageId = useMemo(() => {
    const map = new Map<string, TtsVoiceProfile | null>();
    for (const m of messages) {
      if (!m.voice_profile_id) continue;
      const hit = voiceProfiles.find((p) => p.id === m.voice_profile_id) ?? null;
      map.set(m.id, hit);
    }
    return map;
  }, [messages, voiceProfiles]);

  const refreshSessions = async () => {
    try {
      const list = await api.chatListSessions();
      setSessions(list);
    } catch (e) {
      onError(`Nie udało się wczytać sesji: ${e}`);
    }
  };

  const refreshMessages = async (sessionId: string) => {
    try {
      const list = await api.chatListMessages(sessionId);
      setMessages(list);
    } catch (e) {
      onError(`Nie udało się wczytać wiadomości: ${e}`);
    }
  };

  useEffect(() => {
    void refreshSessions();
    const un1 = listen("chat:session_changed", () => {
      void refreshSessions();
    });
    return () => {
      void un1.then((u) => u());
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    void refreshMessages(activeSessionId);
    const un = listen<{ session_id: string }>("chat:message_added", (e) => {
      if (e.payload.session_id === activeSessionId) {
        void refreshMessages(activeSessionId);
      }
    });
    return () => {
      void un.then((u) => u());
    };
  }, [activeSessionId]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const s = await api.chatCreateSession(newSource);
      await refreshSessions();
      setActiveSessionId(s.id);
      onToast(`Utworzono sesję: ${s.title ?? s.id}`);
    } catch (e) {
      onError(`Błąd tworzenia sesji: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSaved = async (s: ChatSession) => {
    try {
      await api.chatUpdateSession(s.id, null, !s.is_saved);
      await refreshSessions();
    } catch (e) {
      onError(`Błąd aktualizacji: ${e}`);
    }
  };

  const handleDelete = async (s: ChatSession) => {
    if (!confirm(`Usunąć sesję "${s.title ?? s.id}"? Wiadomości też znikną.`)) {
      return;
    }
    try {
      await api.chatDeleteSession(s.id);
      if (activeSessionId === s.id) {
        setActiveSessionId(null);
      }
      await refreshSessions();
    } catch (e) {
      onError(`Błąd usuwania: ${e}`);
    }
  };

  const handleReplay = async (m: ChatMessage) => {
    if (!m.generation_id) {
      onError("Ta wiadomość nie ma audio (assistant message jeszcze nie wygenerowany).");
      return;
    }
    try {
      // Re-fetch in case the message had generation_id=NULL when fetched but
      // a job has since linked it. Falls back to the message's own field.
      const gid = await api.chatReplayMessage(m.id).catch(() => m.generation_id);
      if (!gid) {
        onError("Brak audio dla tej wiadomości.");
        return;
      }
      const url = `http://127.0.0.1:8765/audio/${gid}`;
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      onError(`Nie udało się odtworzyć: ${e}`);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar: list of sessions */}
      <div className="w-64 border-r border-border bg-panel flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="bg-panel2 text-sm rounded px-2 py-1 flex-1 text-heading"
            >
              <option value="hermes">hermes</option>
              <option value="cursor">cursor</option>
              <option value="opencode">opencode</option>
              <option value="custom">custom</option>
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="bg-accent text-bg text-sm px-2 py-1 rounded disabled:opacity-50"
            >
              + Nowa
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="p-4 text-sm text-muted">
              Brak sesji. Utwórz pierwszą powyżej.
            </div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSessionId(s.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-panel2 ${
                s.id === activeSessionId ? "bg-panel2" : ""
              }`}
            >
              <div className="text-sm font-medium truncate flex items-center gap-1">
                {s.is_saved && <span title="Zapisana">⭐</span>}
                <span className="truncate">{s.title ?? s.id}</span>
              </div>
              <div className="text-xs text-muted flex justify-between mt-1">
                <span>{s.source}</span>
                <span>{s.message_count} wiad.</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: messages of active session */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSessionId ? (
          <div className="flex-1 flex items-center justify-center text-muted">
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              <div>Wybierz sesję z lewej strony</div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border flex items-center gap-3 bg-panel shrink-0">
              <div className="text-sm font-medium truncate flex-1">
                {sessions.find((s) => s.id === activeSessionId)?.title ??
                  activeSessionId}
              </div>
              {(() => {
                const s = sessions.find((x) => x.id === activeSessionId);
                if (!s) return null;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleSaved(s)}
                      className="text-sm"
                      title={s.is_saved ? "Usuń z zapisanych" : "Zapisz sesję"}
                    >
                      {s.is_saved ? "⭐" : "☆"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="text-sm text-red-400"
                      title="Usuń sesję"
                    >
                      🗑
                    </button>
                  </>
                );
              })()}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && (
                <div className="text-muted text-sm text-center py-8">
                  Brak wiadomości. Wyślij przez API:
                  <pre className="mt-2 text-xs text-left bg-panel2 p-2 rounded overflow-x-auto">
{`POST /generate
{
  "text": "Cześć",
  "model": "minimax:speech-2.8-hd",
  "voice": "wojciech_mann",
  "format": "mp3",
  "original_prompt": "przywitaj się",
  "chat_session_id": "${activeSessionId}"
}`}
                  </pre>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      m.role === "user"
                        ? "bg-accent text-bg"
                        : "bg-panel2 text-heading"
                    }`}
                  >
                    <div className="text-xs opacity-60 mb-1 flex justify-between items-center gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span>
                          {m.role === "user"
                            ? "Ty"
                            : m.role === "assistant"
                              ? "Asystent"
                              : "System"}
                        </span>
                        {m.role === "assistant" && m.voice_profile_id && (
                          <VoiceProfileBadge
                            profile={profileByMessageId.get(m.id) ?? null}
                            fallbackLabel="Profil usunięty"
                            size="sm"
                            showName
                            className="opacity-90"
                          />
                        )}
                      </span>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                    {m.role === "assistant" && m.generation_id && (
                      <button
                        type="button"
                        onClick={() => handleReplay(m)}
                        className="mt-2 text-xs underline hover:no-underline"
                      >
                        ▶ Odtwórz ponownie
                      </button>
                    )}
                    {m.role === "assistant" && !m.generation_id && (
                      <div className="mt-2 text-xs opacity-60 italic">
                        ⏳ Generowanie audio...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
