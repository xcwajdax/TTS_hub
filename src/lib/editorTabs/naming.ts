const MAX_AUTO_TITLE = 28;

/** Next default tab title: Szkic 1, Szkic 2, … */
export function nextDefaultTabTitle(existingTitles: string[]): string {
  let max = 0;
  for (const t of existingTitles) {
    const m = /^Szkic\s+(\d+)$/i.exec(t.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Szkic ${max + 1}`;
}

/** Increment trailing number: "foo" → "foo 2", "Szkic 3" → "Szkic 4". */
export function incrementTabTitle(title: string): string {
  const trimmed = title.trim() || "Szkic";
  const m = /^(.*?)(?:\s+(\d+))?$/.exec(trimmed);
  if (!m) return `${trimmed} 2`;
  const base = m[1]?.trim() || trimmed;
  const n = m[2] ? Number(m[2]) : 1;
  return `${base} ${n + 1}`;
}

/** Derive tab title from first line of plain text. */
export function titleFromPlainText(text: string): string | null {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return null;
  if (line.length <= MAX_AUTO_TITLE) return line;
  return `${line.slice(0, MAX_AUTO_TITLE - 1).trim()}…`;
}

export function sanitizeFileStem(title: string): string {
  let out = "";
  for (const c of title.trim()) {
    if (c.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(c)) continue;
    out += c;
  }
  const trimmed = out.trim();
  return trimmed || "zakladka";
}
