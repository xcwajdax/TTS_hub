import { useEffect, useRef, useState } from "react";
import type { RoleplayOpenSession } from "../lib/roleplay/useRoleplaySessions";

interface Props {
  sessions: RoleplayOpenSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
  onOpenProjects: () => void;
}

function SessionTabItem({
  session,
  active,
  onSelect,
  onClose,
  onRename,
}: {
  session: RoleplayOpenSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(session.name);
  }, [session.name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={`editor-tab group flex items-center gap-1 shrink-0 max-w-[11rem] border-r border-border/60 ${
        active ? "editor-tab--active bg-panel2 text-heading" : "text-muted hover:text-heading hover:bg-panel2/60"
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="editor-tab__input flex-1 min-w-0 bg-panel border border-border px-1 py-0.5 text-xs text-heading"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(session.name);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          className="editor-tab__label flex-1 min-w-0 px-2 py-1.5 text-xs truncate text-left"
          title={session.name}
          onClick={onSelect}
          onDoubleClick={(e) => {
            e.preventDefault();
            setEditing(true);
          }}
        >
          {session.name}
        </button>
      )}
      <button
        type="button"
        className="editor-tab__close shrink-0 px-1 py-1 text-muted opacity-0 group-hover:opacity-100 hover:text-heading"
        title="Zamknij projekt"
        aria-label={`Zamknij ${session.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function RoleplaySessionTabBar({
  sessions,
  activeId,
  onSelect,
  onClose,
  onRename,
  onAdd,
  onOpenProjects,
}: Props) {
  return (
    <div className="editor-tab-bar flex shrink-0 items-stretch border-b border-border bg-panel min-h-[2rem]">
      <div className="flex flex-1 min-w-0 items-stretch overflow-x-auto scrollbar-thin">
        <button
          type="button"
          className="editor-tab-bar__add shrink-0 px-2.5 text-muted hover:text-heading hover:bg-panel2 border-r border-border/60 touch-none select-none"
          title="Nowy projekt"
          aria-label="Nowy projekt"
          onClick={onAdd}
        >
          +
        </button>
        {sessions.map((session) => (
          <SessionTabItem
            key={session.id}
            session={session}
            active={session.id === activeId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
            onRename={(name) => onRename(session.id, name)}
          />
        ))}
      </div>
      <div className="editor-tab-bar__trailing shrink-0 flex items-center gap-2 px-3 border-l border-border/60">
        <button type="button" className="text-xs text-muted hover:text-heading" onClick={onOpenProjects}>
          Projekty…
        </button>
      </div>
    </div>
  );
}
