import Icon from "../Icon";
import {
  SCOPE_TAB_META,
  type HistoryScopeTab,
} from "../../lib/historyToolbar";

const TAB_ORDER: HistoryScopeTab[] = ["session", "cursor", "bots", "archive", "video", "soundboard"];

interface Props {
  scope: HistoryScopeTab;
  counts: Record<HistoryScopeTab, number>;
  onScopeChange: (scope: HistoryScopeTab) => void;
  soundboardInstalled?: boolean;
}

export default function HistoryScopeTabs({
  scope,
  counts,
  onScopeChange,
  soundboardInstalled = false,
}: Props) {
  const tabs = soundboardInstalled
    ? TAB_ORDER
    : TAB_ORDER.filter((id) => id !== "soundboard");

  return (
    <div className="flex border-b border-border shrink-0" role="tablist" aria-label="Zakres historii">
      {tabs.map((id) => {
        const meta = SCOPE_TAB_META[id];
        const active = scope === id;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            title={meta.title ?? meta.label}
            className={`flex-1 flex items-center justify-center gap-1 py-2 min-w-0 ${
              active
                ? "bg-panel2 text-heading border-b-2 border-accent"
                : "text-muted hover:text-heading"
            }`}
            onClick={() => onScopeChange(id)}
          >
            <Icon name={meta.icon} size={18} />
            {count > 0 && id !== "soundboard" && (
              <span className="text-[10px] tabular-nums text-muted/60 leading-none">{count}</span>
            )}
            {id === "soundboard" && count > 0 && (
              <span className="text-[10px] tabular-nums text-accent/80 leading-none">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
