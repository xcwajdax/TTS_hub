import { useMemo } from "react";
import type { Generation } from "../types";
import { useRelativeTime } from "../hooks/useRelativeTime";
import {
  historyItemSurfaceStyle,
  resolveHistoryItemColor,
} from "../lib/historySourceUi";

interface Props {
  /** All cursor/cursor-skill rows in current session (any status). */
  items: Generation[];
  currentId: string | null;
  onPlay: (g: Generation) => void;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export default function CursorFeed({ items, currentId, onPlay }: Props) {
  const feedItems = useMemo(() => items.slice(0, 30), [items]);

  const stats = useMemo(() => {
    const dayAgo = Date.now() - DAY_MS;
    const recent = feedItems.filter((g) => g.created_at >= dayAgo);
    const totalSec = recent.reduce((s, g) => s + (g.duration_ms ?? 0) / 1000, 0);
    return {
      todayCount: recent.length,
      todayMin: Math.round(totalSec / 60),
      totalCount: feedItems.length,
    };
  }, [feedItems]);

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      <div className="px-3 py-2 text-[11px] text-muted border-b border-border">
        Ostatnia doba: {stats.todayCount} podsumowań · ~{stats.todayMin} min audio · łącznie {stats.totalCount}
      </div>
      {feedItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted px-4 text-center">
          Brak generacji z Cursor. Włącz integrację i poproś agenta o odpowiedź.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {feedItems.map((g) => (
            <FeedRow key={g.id} gen={g} isCurrent={g.id === currentId} onPlay={onPlay} />
          ))}
        </ul>
      )}
      <div className="px-3 py-2 text-[10px] text-muted border-t border-border">
        Skrót: <kbd className="px-1 py-0.5 bg-panel2 border border-border rounded">Ctrl+Shift+P</kbd> — powtórz ostatnie.
      </div>
    </div>
  );
}

function FeedRow({
  gen,
  isCurrent,
  onPlay,
}: {
  gen: Generation;
  isCurrent: boolean;
  onPlay: (g: Generation) => void;
}) {
  const rel = useRelativeTime(gen.created_at);
  const label = gen.title ?? gen.summary_text ?? gen.text.slice(0, 80);
  const accentColor = resolveHistoryItemColor(gen);
  return (
    <li>
      <button
        type="button"
        className={`history-item history-item--compact w-full text-left px-2 py-1.5 rounded-md text-xs border ${
          isCurrent
            ? "history-item--current border-accent bg-panel2"
            : "border-border hover:brightness-110"
        }`}
        style={historyItemSurfaceStyle(accentColor, isCurrent)}
        onClick={() => onPlay(gen)}
        title={gen.conversation_id ? `conv ${gen.conversation_id}` : undefined}
      >
        <div className="flex justify-between gap-2">
          <span className="font-medium truncate">{label}</span>
          <span className="text-[10px] text-muted shrink-0">{rel}</span>
        </div>
        <div className="text-[10px] text-muted">
          {gen.source === "cursor-skill" ? "SKILL" : "CURSOR"} · {gen.status}
          {gen.status === "failed" && gen.error ? ` · ${gen.error.slice(0, 48)}` : ""}
          {gen.status === "done" ? ` · ${gen.voice} · ${gen.format.toUpperCase()}` : ""}
          {gen.duration_ms ? ` · ${Math.round(gen.duration_ms / 1000)}s` : ""}
        </div>
      </button>
    </li>
  );
}
