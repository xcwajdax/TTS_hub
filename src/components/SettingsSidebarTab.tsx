import type { IconSlug } from "../lib/icons";
import Icon from "./Icon";

interface Props {
  active: boolean;
  label: string;
  icon: IconSlug;
  onClick: () => void;
  title?: string;
}

export default function SettingsSidebarTab({ active, label, icon, onClick, title }: Props) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title ?? label}
      className={`settings-sidebar-tab flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-t-md border-b-2 transition-colors min-w-0 ${
        active
          ? "border-accent text-heading bg-panel2/60"
          : "border-transparent text-muted hover:text-heading hover:bg-panel2/30"
      }`}
      onClick={onClick}
    >
      <Icon name={icon} size={16} className="opacity-90" />
      <span className="text-[9px] font-medium leading-tight text-center truncate w-full px-0.5">
        {label}
      </span>
    </button>
  );
}
