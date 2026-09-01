import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor | null;
}

function ToolBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`roleplay-editor-tool ${active ? "roleplay-editor-tool--active" : ""}`}
      title={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function BookEditorToolbar({ editor }: Props) {
  if (!editor) return null;

  const align = (value: "left" | "center" | "right" | "justify") => {
    editor.chain().focus().setTextAlign(value).run();
  };

  return (
    <div className="roleplay-editor-toolbar flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-border bg-panel shrink-0">
      <ToolBtn
        title="Pogrubienie"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn
        title="Kursywa"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolBtn>
      <ToolBtn
        title="Podkreślenie"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolBtn>

      <span className="roleplay-editor-toolbar__sep" aria-hidden />

      <ToolBtn
        title="Wyrównaj do lewej"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => align("left")}
      >
        L
      </ToolBtn>
      <ToolBtn
        title="Wyśrodkuj"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => align("center")}
      >
        C
      </ToolBtn>
      <ToolBtn
        title="Wyrównaj do prawej"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => align("right")}
      >
        R
      </ToolBtn>
      <ToolBtn
        title="Justuj"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => align("justify")}
      >
        J
      </ToolBtn>
    </div>
  );
}
