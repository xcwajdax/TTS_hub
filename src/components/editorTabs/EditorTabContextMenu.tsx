import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onDuplicate: () => void;
  onIncrement: () => void;
  onCopyText: () => void;
  onSaveFile: () => void;
  onCloseTab: () => void;
  onDismiss: () => void;
}

export default function EditorTabContextMenu({
  x,
  y,
  onDuplicate,
  onIncrement,
  onCopyText,
  onSaveFile,
  onCloseTab,
  onDismiss,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  const run = (fn: () => void) => {
    fn();
    onDismiss();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[180px] py-1 border border-border bg-panel shadow-lg text-sm"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button type="button" className="editor-tab-menu__item" role="menuitem" onClick={() => run(onDuplicate)}>
        Duplikuj
      </button>
      <button type="button" className="editor-tab-menu__item" role="menuitem" onClick={() => run(onIncrement)}>
        Inkrementuj nazwę
      </button>
      <button type="button" className="editor-tab-menu__item" role="menuitem" onClick={() => run(onCopyText)}>
        Kopiuj tekst
      </button>
      <button type="button" className="editor-tab-menu__item" role="menuitem" onClick={() => run(onSaveFile)}>
        Zapisz do pliku…
      </button>
      <div className="h-px bg-border/60 my-1" />
      <button type="button" className="editor-tab-menu__item text-red-300/90" role="menuitem" onClick={() => run(onCloseTab)}>
        Zamknij
      </button>
    </div>
  );
}
