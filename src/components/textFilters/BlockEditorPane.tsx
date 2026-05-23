import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import BlockList from "../editor/BlockList";
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
  floatingAction?: ReactNode;
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
  floatingAction,
}: Props) {
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);

  const excludedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of blockDoc.blocks) {
      if (!b.included) ids.add(b.id);
    }
    return ids;
  }, [blockDoc.blocks]);

  const initialHtml = useMemo(() => {
    const src = blockDocToSourceText(blockDoc);
    if (!src.trim()) return undefined;
    return markdownToHtml(src);
  }, []);

  const toggleBlock = (id: string) => {
    onBlockDocChange({
      blocks: blockDoc.blocks.map((b) =>
        b.id === id ? { ...b, included: !b.included } : b,
      ),
    });
  };

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden gap-2">
      <BlockList
        className="w-44 shrink-0 min-h-0 overflow-y-auto border border-border rounded-lg bg-panel2"
        blocks={blockDoc.blocks}
        onToggle={toggleBlock}
        onFocusBlock={setFocusBlockId}
      />
      <RichTextEditor
        value={blockDoc}
        initialHtml={initialHtml}
        excludedBlockIds={excludedIds}
        focusBlockId={focusBlockId}
        onBlockFocused={() => setFocusBlockId(null)}
        onChange={onBlockDocChange}
        onEnterWithCtrl={onEnterWithCtrl}
        placeholder={placeholder}
        floatingAction={floatingAction}
      />
    </div>
  );
}
