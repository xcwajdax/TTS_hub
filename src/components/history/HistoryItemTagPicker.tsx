import { useEffect, useRef, useState } from "react";
import type { ArchiveTag, Generation } from "../../types";
import { setGenerationTags } from "../../api/tauri";
import HistoryToolbarButton from "./HistoryToolbarButton";

interface Props {
  gen: Generation;
  tags: ArchiveTag[];
  disabled?: boolean;
  onChanged: () => void;
  onError: (e: string) => void;
}

export default function HistoryItemTagPicker({
  gen,
  tags,
  disabled,
  onChanged,
  onError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const assigned = new Set(gen.tag_ids ?? []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = async (tagId: string) => {
    const next = new Set(assigned);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSaving(true);
    try {
      await setGenerationTags(gen.id, [...next]);
      onChanged();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <HistoryToolbarButton
        title="Tagi archiwum"
        fallback="#"
        disabled={disabled || saving}
        active={open || assigned.size > 0}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[140px] max-w-[200px] py-1 rounded border border-border bg-panel shadow-lg"
          role="menu"
        >
          {tags.length === 0 ? (
            <p className="px-2 py-1 text-[10px] text-muted">Brak tagów. Utwórz w ustawieniach lub na pasku filtra.</p>
          ) : (
            tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-2 py-1 text-[11px] hover:bg-panel2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={assigned.has(tag.id)}
                  disabled={saving}
                  onChange={() => void toggle(tag.id)}
                />
                {tag.color && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: tag.color }}
                    aria-hidden
                  />
                )}
                <span className="truncate">{tag.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
