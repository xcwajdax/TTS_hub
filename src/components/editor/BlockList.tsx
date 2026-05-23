import type { Block, BlockKind } from "./types";

interface Props {
  blocks: Block[];
  onToggle: (id: string) => void;
  onFocusBlock?: (id: string) => void;
  className?: string;
}

const KIND_LABEL: Record<BlockKind, string> = {
  paragraph: "¶",
  heading: "H",
  blockquote: "cytat",
  code: "kod",
  list: "lista",
  hr: "—",
};

function tagFor(b: Block): string {
  if (b.kind === "heading") return `H${b.meta?.level ?? 1}`;
  if (b.kind === "code") return b.meta?.lang ? `kod(${b.meta.lang})` : "kod";
  if (b.kind === "list") return b.meta?.ordered ? "lista 1." : "lista •";
  return KIND_LABEL[b.kind];
}

function preview(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine || "(pusty)";
  return oneLine.slice(0, max - 1) + "…";
}

export default function BlockList({ blocks, onToggle, onFocusBlock, className }: Props) {
  if (blocks.length === 0) {
    return (
      <div className={`text-xs text-muted p-3 ${className ?? ""}`}>
        Wpisz lub wklej tekst, by zobaczyć listę bloków.
      </div>
    );
  }
  return (
    <ul className={`flex flex-col gap-1 p-2 overflow-auto ${className ?? ""}`}>
      {blocks.map((b) => {
        const disabled = b.kind === "hr";
        return (
          <li
            key={b.id}
            className={`flex items-start gap-2 px-2 py-1.5 rounded border border-border/40 bg-panel2/40 text-xs ${
              !b.included ? "opacity-60" : ""
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-violet-500"
              checked={b.included}
              disabled={disabled}
              onChange={() => onToggle(b.id)}
              aria-label={`Włącz blok ${tagFor(b)}`}
            />
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() => onFocusBlock?.(b.id)}
              title="Pokaż w edytorze"
            >
              <div className="flex items-center gap-1.5">
                <span className="tag">{tagFor(b)}</span>
                {!b.included && <span className="text-[10px] text-muted">wyłączone</span>}
              </div>
              <div
                className={`truncate mt-0.5 ${
                  b.included ? "text-ink" : "text-muted line-through"
                }`}
              >
                {preview(b.text)}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
