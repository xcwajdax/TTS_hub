import type { Editor } from "@tiptap/react";
import type { IconSlug } from "../../lib/icons";
import Icon from "../Icon";

const TOOLBAR_BTN =
  "inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-border bg-panel2 text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed";

function BarBtn({
  title,
  onClick,
  icon,
  fallback,
  disabled,
  active,
}: {
  title: string;
  onClick?: () => void;
  icon?: IconSlug;
  fallback?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${TOOLBAR_BTN} ${active ? "border-accent2/50 bg-panel text-accent2" : ""}`.trim()}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? (
        <Icon name={icon} size={16} />
      ) : (
        <span className="text-[11px] font-semibold leading-none">{fallback ?? "?"}</span>
      )}
    </button>
  );
}

interface Props {
  editor: Editor | null;
}

export default function EditorFormatToolbar({ editor }: Props) {
  const can = !!editor && !editor.isDestroyed;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-panel2/60 shrink-0"
      role="toolbar"
      aria-label="Formatowanie"
    >
      <BarBtn
        title="Pogrubienie"
        fallback="B"
        disabled={!can}
        active={can && editor.isActive("bold")}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <BarBtn
        title="Kursywa"
        fallback="I"
        disabled={!can}
        active={can && editor.isActive("italic")}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <BarBtn title="Podkreślenie (wkrótce)" fallback="U" disabled />
      <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
      <BarBtn title="Wyrównaj do lewej (wkrótce)" fallback="≡" disabled />
      <BarBtn title="Wyśrodkuj (wkrótce)" fallback="≡" disabled />
      <BarBtn title="Wyrównaj do prawej (wkrótce)" fallback="≡" disabled />
      <BarBtn title="Wyjustuj (wkrótce)" fallback="≡" disabled />
      <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
      <BarBtn
        title="Cytat"
        fallback="❝"
        disabled={!can}
        active={can && editor.isActive("blockquote")}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />
      <BarBtn
        title="Cofnij"
        icon="undo"
        disabled={!can || !editor.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <BarBtn
        title="Ponów"
        icon="redo"
        disabled={!can || !editor.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      />
    </div>
  );
}
