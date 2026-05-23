import type { ReactNode } from "react";

interface Props {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** `toolbar` for filter rows, `group` for segmented controls. */
  role?: "toolbar" | "group";
  ariaLabel?: string;
}

export default function HistoryToolbarRow({
  label,
  hint,
  children,
  className = "",
  role = "toolbar",
  ariaLabel,
}: Props) {
  return (
    <div
      className={`history-toolbar-row flex flex-col gap-1 px-2 py-1.5 border-b border-border shrink-0 min-w-0 overflow-hidden ${className}`.trim()}
      role={role}
      aria-label={ariaLabel ?? label}
    >
      <div className="history-toolbar-row__head flex items-baseline gap-1.5 min-w-0 w-full">
        <span className="text-[10px] font-medium text-muted leading-none shrink-0">{label}</span>
        {hint ? (
          <span className="text-[9px] text-muted/70 leading-snug truncate min-w-0">{hint}</span>
        ) : null}
      </div>
      <div className="history-toolbar-row__content w-full min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
