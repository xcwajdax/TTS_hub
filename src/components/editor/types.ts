export type BlockKind =
  | "paragraph"
  | "heading"
  | "blockquote"
  | "code"
  | "list"
  | "hr";

export interface BlockMeta {
  level?: number;
  lang?: string;
  ordered?: boolean;
}

export interface Block {
  id: string;
  kind: BlockKind;
  text: string;
  meta?: BlockMeta;
  included: boolean;
}

export interface BlockDoc {
  blocks: Block[];
}

export const EMPTY_DOC: BlockDoc = { blocks: [] };

export function isDocEmpty(doc: BlockDoc): boolean {
  return doc.blocks.every((b) => b.text.trim().length === 0);
}

export function defaultIncluded(kind: BlockKind): boolean {
  return kind !== "code";
}
