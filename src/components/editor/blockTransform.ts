import { marked } from "marked";
import TurndownService from "turndown";
import { nanoid } from "nanoid";
import type { Node as PMNode } from "@tiptap/pm/model";
import { defaultIncluded, type Block, type BlockDoc, type BlockKind } from "./types";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

marked.setOptions({ gfm: true, breaks: false });

export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

const MARKDOWN_HINTS = [
  /^\s{0,3}#{1,6}\s+\S/m,
  /^\s{0,3}>\s+\S/m,
  /^\s{0,3}[-*+]\s+\S/m,
  /^\s{0,3}\d+\.\s+\S/m,
  /```[\s\S]*?```/,
  /`[^`\n]+`/,
  /\*\*[^*\n]+\*\*/,
  /\[[^\]]+\]\([^)]+\)/,
];

export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  let hits = 0;
  for (const re of MARKDOWN_HINTS) if (re.test(text)) hits += 1;
  return hits >= 1;
}

const nodeIdMap = new WeakMap<PMNode, string>();
export function idFor(node: PMNode): string {
  let id = nodeIdMap.get(node);
  if (!id) {
    id = nanoid(8);
    nodeIdMap.set(node, id);
  }
  return id;
}

function kindFromNode(node: PMNode): BlockKind | null {
  switch (node.type.name) {
    case "paragraph":
      return "paragraph";
    case "heading":
      return "heading";
    case "blockquote":
      return "blockquote";
    case "codeBlock":
      return "code";
    case "bulletList":
    case "orderedList":
      return "list";
    case "horizontalRule":
      return "hr";
    default:
      return null;
  }
}

function listText(node: PMNode): string {
  const items: string[] = [];
  node.forEach((item) => {
    items.push(item.textContent.trim());
  });
  return items.join("\n");
}

export function docToBlocks(
  doc: PMNode,
  previous?: Block[],
): Block[] {
  const prevById = new Map(previous?.map((b) => [b.id, b]));
  const out: Block[] = [];
  doc.forEach((node) => {
    const kind = kindFromNode(node);
    if (!kind) return;
    const id = idFor(node);
    const prev = prevById.get(id);
    const text =
      kind === "list"
        ? listText(node)
        : kind === "hr"
        ? ""
        : node.textContent;
    const meta = {
      ...(kind === "heading" ? { level: (node.attrs as any).level ?? 1 } : {}),
      ...(kind === "code" ? { lang: (node.attrs as any).language ?? null } : {}),
      ...(kind === "list" ? { ordered: node.type.name === "orderedList" } : {}),
    };
    out.push({
      id,
      kind,
      text,
      meta,
      included: prev ? prev.included : defaultIncluded(kind),
    });
  });
  return out;
}

export interface FlattenOptions {
  skipDisabled?: boolean;
  skipCode?: boolean;
  skipBlockquote?: boolean;
}

export function blocksToPlainText(
  blocks: Block[],
  opts: FlattenOptions = {},
): string {
  const { skipDisabled = true, skipCode = true, skipBlockquote = false } = opts;
  const parts: string[] = [];
  for (const b of blocks) {
    if (skipDisabled && !b.included) continue;
    if (b.kind === "hr") continue;
    if (b.kind === "code" && skipCode) continue;
    if (b.kind === "blockquote" && skipBlockquote) continue;
    const t = b.text.trim();
    if (!t) continue;
    parts.push(t);
  }
  return parts.join("\n\n");
}

export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    const text = b.text;
    switch (b.kind) {
      case "heading": {
        const lvl = Math.min(Math.max(b.meta?.level ?? 1, 1), 6);
        out.push(`${"#".repeat(lvl)} ${text}`);
        break;
      }
      case "blockquote":
        out.push(
          text
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n"),
        );
        break;
      case "code": {
        const lang = b.meta?.lang ?? "";
        out.push("```" + lang + "\n" + text + "\n```");
        break;
      }
      case "list": {
        const ordered = b.meta?.ordered ?? false;
        out.push(
          text
            .split("\n")
            .map((l, i) => (ordered ? `${i + 1}. ${l}` : `- ${l}`))
            .join("\n"),
        );
        break;
      }
      case "hr":
        out.push("---");
        break;
      case "paragraph":
      default:
        out.push(text);
    }
  }
  return out.join("\n\n");
}

export function plainTextToDoc(text: string): BlockDoc {
  const paragraphs = text.split(/\n{2,}/);
  const blocks: Block[] = paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map<Block>((p) => ({
      id: nanoid(8),
      kind: "paragraph",
      text: p,
      included: true,
    }));
  return { blocks };
}
