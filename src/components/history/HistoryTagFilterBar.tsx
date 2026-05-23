import type { ArchiveTag } from "../../types";
import { HISTORY_TOOLBAR_BTN, HISTORY_TOOLBAR_BTN_ACTIVE } from "../../lib/historyToolbar";
import HistoryToolbarButton from "./HistoryToolbarButton";

interface Props {
  tags: ArchiveTag[];
  selectedTagIds: Set<string>;
  onToggleTag: (tagId: string) => void;
  onClear: () => void;
  onCreateTag: () => void;
}

export default function HistoryTagFilterBar({
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  onCreateTag,
}: Props) {
  const anySelected = selectedTagIds.size > 0;

  return (
    <div
      className="flex flex-nowrap items-center gap-0.5 p-2 border-b border-border overflow-x-auto shrink-0"
      role="toolbar"
      aria-label="Filtr tagów archiwum"
    >
      <button
        type="button"
        className={`${HISTORY_TOOLBAR_BTN} shrink-0 text-[11px] font-medium px-2 ${
          !anySelected ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
        }`}
        title="Wszystkie tagi"
        aria-pressed={!anySelected}
        onClick={onClear}
      >
        Wszystkie
      </button>
      {tags.map((tag) => {
        const active = selectedTagIds.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            className={`${HISTORY_TOOLBAR_BTN} shrink-0 text-[11px] font-medium px-2 max-w-[120px] truncate ${
              active ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
            }`}
            title={tag.name}
            aria-pressed={active}
            onClick={() => onToggleTag(tag.id)}
          >
            {tag.color && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle shrink-0"
                style={{ background: tag.color }}
                aria-hidden
              />
            )}
            {tag.name}
          </button>
        );
      })}
      <HistoryToolbarButton
        className="shrink-0 ml-auto"
        title="Nowy tag"
        fallback="+"
        onClick={onCreateTag}
      />
    </div>
  );
}
