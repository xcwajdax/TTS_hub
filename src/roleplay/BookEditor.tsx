import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";

interface Props {
  docJson: string;
  activeColor: string | null;
  onDocChange: (json: string) => void;
  disabled?: boolean;
}

export default function BookEditor({ docJson, activeColor, onDocChange, disabled }: Props) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Highlight.configure({ multicolor: true }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: JSON.parse(docJson || '{"type":"doc","content":[{"type":"paragraph"}]}'),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onDocChange(JSON.stringify(ed.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor || !activeColor) return;
    editor.chain().focus().setHighlight({ color: activeColor }).run();
  }, [editor, activeColor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className="roleplay-book-editor flex-1 min-h-0 border border-border rounded-lg bg-panel2 overflow-auto">
      <EditorContent
        editor={editor}
        className="prose prose-invert max-w-none p-4 min-h-[280px] focus:outline-none text-sm leading-relaxed"
      />
    </div>
  );
}
