import type { ReactNode } from "react";
import type { FieldAvailability } from "../../../lib/voiceProfileProviderCapabilities";

interface Props {
  label: string;
  tooltip?: string;
  defaultHint?: string;
  availability?: FieldAvailability;
  disabledReason?: string;
  children: ReactNode;
  onContextMenuReset?: () => void;
  className?: string;
  voiceProfileUi?: boolean;
}

export default function ProfileFieldShell({
  label,
  tooltip,
  defaultHint,
  availability = "implemented",
  disabledReason,
  children,
  onContextMenuReset,
  className = "",
  voiceProfileUi = false,
}: Props) {
  const isInactive = availability !== "implemented";
  const hint = [tooltip, defaultHint ? `Domyślnie: ${defaultHint}` : null, disabledReason]
    .filter(Boolean)
    .join(" · ");

  return (
    <label
      className={`${voiceProfileUi ? "vp-form__label" : "flex flex-col gap-1 text-xs"} ${isInactive ? "text-muted/50" : voiceProfileUi ? "" : "text-muted"} ${className}`}
      title={hint || undefined}
      onContextMenu={
        onContextMenuReset
          ? (e) => {
              e.preventDefault();
              onContextMenuReset();
            }
          : undefined
      }
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="truncate">{label}</span>
        {availability === "roadmap" ? (
          <span className={voiceProfileUi ? "vp-badge" : "shrink-0 text-[9px] uppercase tracking-wide px-1 py-px rounded bg-panel2 border border-border text-muted"}>
            Roadmapa
          </span>
        ) : null}
        {availability === "disabled" ? (
          <span className={voiceProfileUi ? "vp-badge" : "shrink-0 text-[9px] uppercase tracking-wide px-1 py-px rounded bg-panel2 border border-border text-muted/70"}>
            Niedostępne
          </span>
        ) : null}
        {tooltip ? (
          <span className="shrink-0 opacity-60 cursor-help" title={hint}>
            ⓘ
          </span>
        ) : null}
      </span>
      <div className={isInactive ? "pointer-events-none opacity-50" : undefined}>{children}</div>
      {isInactive && disabledReason ? (
        <span className="text-[10px] text-muted/60 leading-snug">{disabledReason}</span>
      ) : null}
    </label>
  );
}
