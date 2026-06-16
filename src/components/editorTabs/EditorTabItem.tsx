import { useEffect, useRef, useState } from "react";
import type { EditorTab } from "../../lib/editorTabs/types";
import EditorTabContextMenu from "./EditorTabContextMenu";

interface Props {
  tab: EditorTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onIncrement: () => void;
  onCopyText: () => void;
  onSaveFile: () => void;
}

export default function EditorTabItem({
  tab,
  active,
  onSelect,
  onClose,
  onRename,
  onDuplicate,
  onIncrement,
  onCopyText,
  onSaveFile,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraftTitle(tab.title);
  }, [tab.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  };

  return (
    <>
      <div
        className={`editor-tab group flex items-center gap-1 shrink-0 max-w-[11rem] border-r border-border/60 ${
          active ? "editor-tab--active bg-panel2 text-heading" : "text-muted hover:text-heading hover:bg-panel2/60"
        }`}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="editor-tab__input flex-1 min-w-0 bg-panel border border-border px-1 py-0.5 text-xs text-heading"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraftTitle(tab.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="editor-tab__label flex-1 min-w-0 px-2 py-1.5 text-xs truncate text-left"
            title={tab.title}
            onClick={onSelect}
            onDoubleClick={(e) => {
              e.preventDefault();
              setEditing(true);
            }}
          >
            {tab.title}
            {tab.generationId ? (
              <span className="ml-1 text-[9px] text-accent2" title="Wygenerowano">
                ●
              </span>
            ) : null}
          </button>
        )}
        <button
          type="button"
          className="editor-tab__close shrink-0 px-1 py-1 text-muted opacity-0 group-hover:opacity-100 hover:text-heading"
          title="Zamknij zakładkę"
          aria-label={`Zamknij ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
      {menu ? (
        <EditorTabContextMenu
          x={menu.x}
          y={menu.y}
          onDuplicate={onDuplicate}
          onIncrement={onIncrement}
          onCopyText={onCopyText}
          onSaveFile={onSaveFile}
          onCloseTab={onClose}
          onDismiss={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}
