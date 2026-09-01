import type { RoleplayViewTab } from "./types";

interface Props {
  tab: RoleplayViewTab;
  onChange: (tab: RoleplayViewTab) => void;
  hasTimeline?: boolean;
}

const TABS: { id: RoleplayViewTab; label: string }[] = [
  { id: "script", label: "Skrypt" },
  { id: "timeline", label: "Oś czasu" },
];

export default function RoleplayViewTabs({ tab, onChange, hasTimeline }: Props) {
  return (
    <div
      className="roleplay-view-tabs flex shrink-0 border-b border-border bg-panel overflow-x-auto"
      role="tablist"
      aria-label="Widok roleplay"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={`app-view-tab flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0 min-w-0 ${
            tab === t.id
              ? "bg-panel2 text-heading border-b-2 border-accent"
              : "text-muted hover:text-heading"
          }`}
          onClick={() => onChange(t.id)}
        >
          <span className="truncate">{t.label}</span>
          {t.id === "timeline" && hasTimeline ? (
            <span className="text-[9px] text-accent2" title="Ma wygenerowane klipy">
              ●
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
