import { nanoid } from "nanoid";
import type { PaletteEntry, RoleplaySegment } from "./types";

interface TipTapNode {
  type?: string;
  text?: string;
  marks?: Array<{ type?: string; attrs?: { color?: string } }>;
  content?: TipTapNode[];
}

interface TipTapDoc {
  type?: string;
  content?: TipTapNode[];
}

function walkNodes(
  nodes: TipTapNode[] | undefined,
  onText: (text: string, color: string | null) => void,
) {
  if (!nodes) return;
  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      let color: string | null = null;
      for (const mark of node.marks ?? []) {
        if (mark.type === "highlight" && mark.attrs?.color) {
          color = mark.attrs.color;
          break;
        }
      }
      onText(node.text, color);
    }
    if (node.content) walkNodes(node.content, onText);
  }
}

/**
 * Extract highlighted fragments in reading order. Unhighlighted text is skipped.
 * Adjacent fragments with the same color+voice merge into one segment.
 */
export function docToSegments(docJson: string, palette: PaletteEntry[]): RoleplaySegment[] {
  const colorToProfile = new Map(palette.map((p) => [p.color, p.voiceProfileId]));
  const doc = JSON.parse(docJson) as TipTapDoc;
  const raw: Array<{ text: string; color: string }> = [];

  walkNodes(doc.content, (text, color) => {
    if (!color || !text) return;
    const profileId = colorToProfile.get(color);
    if (!profileId) return;
    raw.push({ text, color });
  });

  const merged: Array<{ text: string; color: string; voice_profile_id: string }> = [];
  for (const piece of raw) {
    const voiceProfileId = colorToProfile.get(piece.color);
    if (!voiceProfileId) continue;
    const last = merged[merged.length - 1];
    if (last && last.color === piece.color && last.voice_profile_id === voiceProfileId) {
      last.text += piece.text;
    } else {
      merged.push({
        text: piece.text,
        color: piece.color,
        voice_profile_id: voiceProfileId,
      });
    }
  }

  return merged
    .map((m, i) => ({
      id: nanoid(),
      order_index: i,
      text: m.text.trim(),
      voice_profile_id: m.voice_profile_id,
      color: m.color,
      status: "pending",
    }))
    .filter((s) => s.text.length > 0);
}
