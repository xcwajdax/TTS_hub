import type { Generation } from "../types";

/** First sentence or line of TTS text, capped for list display. */
export function deriveTitleFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Bez tytułu";

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? trimmed;
  const match = firstLine.match(/^[^.!?]+[.!?]?/);
  let title = (match?.[0] ?? firstLine).trim();
  if (!title) return "Bez tytułu";
  if (title.length > 80) title = `${title.slice(0, 80)}…`;
  return title;
}

export function displayTitle(gen: Generation): string {
  const stored = gen.title?.trim();
  return stored || deriveTitleFromText(gen.text);
}
