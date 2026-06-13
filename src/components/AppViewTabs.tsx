import Icon from "./Icon";
import type { IconSlug } from "../lib/icons";

export type AppView =
  | "tts"
  | "roleplay"
  | "history"
  | "minimax_voices"
  | "extensions"
  | "chat"
  | "settings";

interface TabDef {
  id: AppView;
  label: string;
  icon: IconSlug;
  hidden?: boolean;
}

interface Props {
  view: AppView;
  onViewChange: (view: AppView) => void;
  showMinimaxVoices?: boolean;
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: IconSlug;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={label}
      className={`app-view-tab flex items-center gap-1.5 px-3 py-2 text-sm shrink-0 min-w-0 ${
        active
          ? "bg-panel2 text-heading border-b-2 border-accent"
          : "text-muted hover:text-heading"
      }`}
      onClick={onClick}
    >
      <Icon name={icon} size={16} className="shrink-0 opacity-90" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function AppViewTabs({ view, onViewChange, showMinimaxVoices }: Props) {
  const tabs: TabDef[] = [
    { id: "tts", label: "TTS", icon: "tab-tts" },
    { id: "roleplay", label: "Roleplay", icon: "tab-roleplay" },
    { id: "history", label: "Historia", icon: "tab-history" },
    {
      id: "minimax_voices",
      label: "Głosy Minimax",
      icon: "tab-minimax",
      hidden: !showMinimaxVoices,
    },
    { id: "extensions", label: "Rozszerzenia", icon: "tab-extensions" },
    { id: "chat", label: "Czat", icon: "tab-chat" },
    { id: "settings", label: "Ustawienia", icon: "tab-settings" },
  ];

  return (
    <div
      className="flex border-b border-border shrink-0 bg-panel overflow-x-auto"
      role="tablist"
      aria-label="Widok aplikacji"
      data-tour="app-tabs"
    >
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => (
          <TabButton
            key={t.id}
            active={view === t.id}
            label={t.label}
            icon={t.icon}
            onClick={() => onViewChange(t.id)}
          />
        ))}
    </div>
  );
}
