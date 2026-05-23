import type { GenerationSource } from "../../types";
import { SOURCE_FILTER_META, SOURCE_FILTER_ORDER, sourceFilterAccent } from "../../lib/historySourceUi";
import { useSourceAvatars } from "../../hooks/useAvatars";
import HistoryToolbarButton from "./HistoryToolbarButton";
import HistoryToolbarRow from "./HistoryToolbarRow";

export type SourceFilter = "all" | GenerationSource;

interface Props {
  value: SourceFilter;
  onChange: (value: SourceFilter) => void;
}

export default function HistorySourceFilterBar({ value, onChange }: Props) {
  const sourceAvatars = useSourceAvatars();

  return (
    <HistoryToolbarRow label="Źródło" hint="Skąd powstała generacja">
      <div
        className="history-toolbar-source-grid grid grid-cols-3 w-full min-w-0 gap-0.5"
        role="presentation"
      >
        {SOURCE_FILTER_ORDER.map((id) => {
          const meta = SOURCE_FILTER_META[id];
          const active = value === id;
          return (
            <HistoryToolbarButton
              key={id}
              fill
              label={meta.label}
              title={meta.description}
              icon={meta.icon}
              avatarPath={id === "all" ? null : sourceAvatars[id]}
              active={active}
              accentColor={sourceFilterAccent(id)}
              onClick={() => onChange(id)}
            />
          );
        })}
      </div>
    </HistoryToolbarRow>
  );
}
