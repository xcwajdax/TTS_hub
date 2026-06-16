import { useEffect, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import bash from "highlight.js/lib/languages/bash";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { docToBlocks, idFor, looksLikeMarkdown, markdownToHtml } from "./blockTransform";
import type { Block, BlockDoc } from "./types";

const lowlight = createLowlight();
lowlight.register({ javascript, js: javascript, typescript, ts: typescript, bash, sh: bash, shell: bash, python, py: python, json });

const excludedKey = new PluginKey<{ ids: Set<string> }>("excludedBlocks");

function ExcludedBlocksExtension() {
  return Extension.create({
    name: "excludedBlocks",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: excludedKey,
          state: {
            init: () => ({ ids: new Set<string>() }),
            apply(tr, prev) {
              const meta = tr.getMeta(excludedKey);
              if (meta) return meta;
              return prev;
            },
          },
          props: {
            decorations(state) {
              const stateData = excludedKey.getState(state);
              const ids = stateData?.ids ?? new Set<string>();
              if (ids.size === 0) return DecorationSet.empty;
              const decos: Decoration[] = [];
              state.doc.forEach((node, offset) => {
                const id = idFor(node);
                if (ids.has(id)) {
                  decos.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: "block-excluded",
                    }),
                  );
                }
              });
              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}

export interface RichTextEditorProps {
  value: BlockDoc;
  initialHtml?: string;
  onChange: (doc: BlockDoc) => void;
  onEnterWithCtrl?: () => void;
  excludedBlockIds?: ReadonlySet<string>;
  disabled?: boolean;
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
}

export default function RichTextEditor({
  value,
  initialHtml,
  onChange,
  onEnterWithCtrl,
  excludedBlockIds,
  disabled,
  placeholder,
  onEditorReady,
}: RichTextEditorProps) {
  const prevBlocksRef = useRef<Block[]>(value.blocks);
  prevBlocksRef.current = value.blocks;
  const placeholderRef = useRef(placeholder ?? "");
  placeholderRef.current = placeholder ?? "";

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      ExcludedBlocksExtension(),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialHtml ?? "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none",
        "data-placeholder": placeholderRef.current,
      },
      handleKeyDown(_view, event) {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          onEnterWithCtrl?.();
          return true;
        }
        return false;
      },
      handlePaste(view, event) {
        const cb = event.clipboardData;
        if (!cb) return false;
        const html = cb.getData("text/html");
        if (html && html.trim().length > 0) return false;
        const text = cb.getData("text/plain");
        if (!text) return false;
        if (!looksLikeMarkdown(text)) return false;
        try {
          const rendered = markdownToHtml(text);
          const container = document.createElement("div");
          container.innerHTML = rendered;
          const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(
            container,
            { preserveWhitespace: true },
          );
          const tr = view.state.tr.replaceSelection(slice).scrollIntoView();
          view.dispatch(tr);
          event.preventDefault();
          return true;
        } catch {
          return false;
        }
      },
    },
    onUpdate({ editor }) {
      const blocks = docToBlocks(editor.state.doc, prevBlocksRef.current);
      onChange({ blocks });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const sync = () => {
      root.dataset.placeholder = placeholder ?? "";
      root.dataset.empty = editor.isEmpty ? "true" : "false";
    };
    sync();
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor, placeholder]);

  useEffect(() => {
    if (!editor) return;
    const ids = new Set(excludedBlockIds ?? []);
    editor.view.dispatch(editor.state.tr.setMeta(excludedKey, { ids }));
  }, [editor, excludedBlockIds]);

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  return <EditorContent editor={editor} className="tts-editor-content" />;
}
