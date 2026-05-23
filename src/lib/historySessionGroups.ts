import type { Generation } from "../types";
import {
  groupGenerationsByDate,
  type HistoryDateGroup,
} from "./historyDateGroups";

export interface HistorySessionGroup {
  sessionId: string;
  isCurrent: boolean;
  label: string;
  dateGroups: HistoryDateGroup[];
}

function sessionStartedAt(items: Generation[]): number {
  return Math.min(...items.map((g) => g.created_at));
}

function formatPriorSessionLabel(startedAtMs: number): string {
  const label = new Date(startedAtMs).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Sesja · ${label}`;
}

export function groupGenerationsBySession(
  items: Generation[],
  currentSessionId: string,
): HistorySessionGroup[] {
  const bySession = new Map<string, Generation[]>();
  for (const gen of items) {
    const list = bySession.get(gen.session_id);
    if (list) list.push(gen);
    else bySession.set(gen.session_id, [gen]);
  }

  const sessionIds = [...bySession.keys()].sort((a, b) => {
    const aStart = sessionStartedAt(bySession.get(a)!);
    const bStart = sessionStartedAt(bySession.get(b)!);
    return bStart - aStart;
  });

  const ordered: string[] = [];
  if (bySession.has(currentSessionId)) {
    ordered.push(currentSessionId);
  }
  for (const sid of sessionIds) {
    if (sid !== currentSessionId) ordered.push(sid);
  }

  return ordered.map((sessionId) => {
    const sessionItems = bySession.get(sessionId)!;
    const isCurrent = sessionId === currentSessionId;
    const startedAt = sessionStartedAt(sessionItems);
    return {
      sessionId,
      isCurrent,
      label: isCurrent ? "Bieżąca sesja" : formatPriorSessionLabel(startedAt),
      dateGroups: groupGenerationsByDate(sessionItems),
    };
  });
}
