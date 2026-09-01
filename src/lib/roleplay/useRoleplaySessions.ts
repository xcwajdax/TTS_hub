import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface RoleplayOpenSession {
  id: string;
  name: string;
}

interface PersistedState {
  sessions: RoleplayOpenSession[];
  activeId: string | null;
}

const STORAGE_KEY = "roleplay_open_sessions_v1";
const PERSIST_DEBOUNCE_MS = 300;

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], activeId: null };
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.sessions)) return { sessions: [], activeId: null };
    return {
      sessions: parsed.sessions.filter((s) => s?.id && s?.name),
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return { sessions: [], activeId: null };
  }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function useRoleplaySessions() {
  const [state, setState] = useState<PersistedState>(loadState);
  const persistTimerRef = useRef<number | null>(null);

  const schedulePersist = useCallback((next: PersistedState) => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      saveState(next);
      persistTimerRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (updater: (prev: PersistedState) => PersistedState) => {
      setState((prev) => {
        const next = updater(prev);
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const activeSession = useMemo(
    () => state.sessions.find((s) => s.id === state.activeId) ?? null,
    [state.sessions, state.activeId],
  );

  const openSession = useCallback(
    (id: string, name: string) => {
      commit((prev) => {
        const existing = prev.sessions.find((s) => s.id === id);
        const sessions = existing
          ? prev.sessions.map((s) => (s.id === id ? { ...s, name } : s))
          : [...prev.sessions, { id, name }];
        return { sessions, activeId: id };
      });
    },
    [commit],
  );

  const closeSession = useCallback(
    (id: string) => {
      commit((prev) => {
        const idx = prev.sessions.findIndex((s) => s.id === id);
        if (idx < 0) return prev;
        const sessions = prev.sessions.filter((s) => s.id !== id);
        if (sessions.length === 0) {
          return { sessions: [], activeId: null };
        }
        let activeId = prev.activeId;
        if (prev.activeId === id) {
          const neighbor = sessions[Math.min(idx, sessions.length - 1)]!;
          activeId = neighbor.id;
        }
        return { sessions, activeId };
      });
    },
    [commit],
  );

  const renameSession = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
      }));
    },
    [commit],
  );

  const setActiveId = useCallback(
    (id: string) => {
      commit((prev) => {
        if (!prev.sessions.some((s) => s.id === id)) return prev;
        return { ...prev, activeId: id };
      });
    },
    [commit],
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  return {
    sessions: state.sessions,
    activeId: state.activeId,
    activeSession,
    openSession,
    closeSession,
    renameSession,
    setActiveId,
  };
}

export type UseRoleplaySessionsReturn = ReturnType<typeof useRoleplaySessions>;
