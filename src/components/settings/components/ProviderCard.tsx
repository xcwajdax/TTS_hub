import { useState, type ReactNode } from "react";
import Icon from "../../Icon";
import type { IconSlug } from "../../../lib/icons";

export type ProviderStatus = "configured" | "missing" | "disabled";

const STATUS_LABELS: Record<ProviderStatus, string> = {
  configured: "Skonfigurowany",
  missing: "Brak klucza / adresu",
  disabled: "Wyłączony",
};

const STATUS_CLASSES: Record<ProviderStatus, string> = {
  configured: "text-green-400/90",
  missing: "text-amber-400/90",
  disabled: "text-muted",
};

interface Props {
  icon: IconSlug;
  title: string;
  status: ProviderStatus;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export default function ProviderCard({
  icon,
  title,
  status,
  defaultExpanded = false,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-border rounded-md bg-panel2/30 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-panel2/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Icon name={icon} size={20} className="shrink-0 opacity-90" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className={`text-[11px] ${STATUS_CLASSES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </span>
        <span className="text-muted text-xs shrink-0">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded ? (
        <div className="px-3 pb-3 pt-1 border-t border-border flex flex-col gap-3">{children}</div>
      ) : null}
    </div>
  );
}
