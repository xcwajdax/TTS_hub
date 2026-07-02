import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import EditorFormatToolbar from "../editor/EditorFormatToolbar";
import RichTextEditor from "../editor/RichTextEditor";
import { blocksToPlainText, markdownToHtml, plainTextToDoc } from "../editor/blockTransform";
import type { BlockDoc } from "../editor/types";
import { EMPTY_DOC } from "../editor/types";
import { mergeBuiltinToggles } from "../../lib/textFiltersTypes";
import type { TextFilterPreset } from "../../lib/textFiltersTypes";
import type { BuiltinFilterOverrides } from "../../lib/textFiltersTypes";

interface Props {
  blockDoc: BlockDoc;
  onBlockDocChange: (doc: BlockDoc) => void;
  onEnterWithCtrl?: () => void;
  placeholder?: string;
  footerAction?: ReactNode;
}

export function blockDocToSourceText(doc: BlockDoc): string {
  return blocksToPlainText(doc.blocks, {
    skipDisabled: false,
    skipCode: false,
    skipBlockquote: false,
  });
}

export function blockDocToFilteredBase(
  doc: BlockDoc,
  preset: TextFilterPreset,
  sessionOverrides: BuiltinFilterOverrides,
): string {
  const builtins = mergeBuiltinToggles(preset, sessionOverrides);
  return blocksToPlainText(doc.blocks, {
    skipDisabled: true,
    skipCode: builtins.strip_fenced_code,
    skipBlockquote: builtins.strip_blockquotes,
  });
}

/** Gdy filtered base jest pusty (np. cały tekst w bloku kodu), użyj pełnego source. */
export function resolveFilterSourceText(
  doc: BlockDoc,
  preset: TextFilterPreset,
  sessionOverrides?: BuiltinFilterOverrides | null,
): string {
  const base = blockDocToFilteredBase(doc, preset, sessionOverrides ?? {});
  if (base.trim().length > 0) return base;
  const full = blockDocToSourceText(doc);
  if (full.trim().length > 0) return full;
  return base;
}

export function plainTextToBlockDoc(text: string): BlockDoc {
  const trimmed = text.trim();
  if (!trimmed) return EMPTY_DOC;
  return plainTextToDoc(trimmed);
}

export default function BlockEditorPane({
  blockDoc,
  onBlockDocChange,
  onEnterWithCtrl,
  placeholder,
  footerAction,
}: Props) {
  const [editor, setEditor] = useState<Editor | null>(null);

  const initialHtml = useMemo(() => {
    const src = blockDocToSourceText(blockDoc);
    if (!src.trim()) return undefined;
    return markdownToHtml(src);
  }, []);

  return (
    <div className="tts-editor-pane">
      <EditorFormatToolbar editor={editor} />
      <div className="tts-editor-surface flex-1 flex flex-col min-h-0 min-w-0">
        <RichTextEditor
          value={blockDoc}
          initialHtml={initialHtml}
          onChange={onBlockDocChange}
          onEnterWithCtrl={onEnterWithCtrl}
          placeholder={placeholder}
          onEditorReady={setEditor}
        />
      </div>
      {footerAction ? <div className="tts-editor-pane__footer tts-editor-surface">{footerAction}</div> : null}
    </div>
  );
}
