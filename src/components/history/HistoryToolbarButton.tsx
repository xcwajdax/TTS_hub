import type { IconSlug } from "../../lib/icons";
import {
  historySourceToolbarActiveStyle,
  historySourceToolbarIdleStyle,
} from "../../lib/historySourceUi";
import { HISTORY_TOOLBAR_BTN, HISTORY_TOOLBAR_BTN_ACTIVE } from "../../lib/historyToolbar";
import AvatarImage from "../avatars/AvatarImage";
import Icon from "../Icon";

interface Props {
  /** Visible chip text (optional; icon-only when omitted). */
  label?: string;
  /** Tooltip — full description when `label` is short. */
  title: string;
  onClick?: () => void;
  icon?: IconSlug;
  /** Custom JPG avatar (overrides icon when set). */
  avatarPath?: string | null;
  avatarCacheKey?: number;
  fallback?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  /** Source accent for filter chips (active + idle hint). */
  accentColor?: string;
  /** Fill grid cell: icon left, label right. */
  fill?: boolean;
}

export default function HistoryToolbarButton({
  label,
  title,
  onClick,
  icon,
  avatarPath,
  avatarCacheKey,
  fallback,
  disabled,
  active,
  className = "",
  accentColor,
  fill = false,
}: Props) {
  const ariaLabel = label && label !== title ? `${label}. ${title}` : title;
  const useSourceAccent = Boolean(accentColor);
  const activeClass =
    active && !useSourceAccent ? HISTORY_TOOLBAR_BTN_ACTIVE : active ? "history-toolbar-btn-source-active" : "";
  const accentStyle = accentColor
    ? active
      ? historySourceToolbarActiveStyle(accentColor)
      : historySourceToolbarIdleStyle(accentColor)
    : undefined;

  if (fill) {
    return (
      <button
        type="button"
        className={[
          HISTORY_TOOLBAR_BTN,
          "history-toolbar-cell-btn",
          "!min-w-0 w-full h-7 px-0.5 justify-center",
          activeClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={accentStyle}
        title={title}
        aria-label={ariaLabel}
        aria-pressed={active}
        onClick={onClick}
        disabled={disabled}
      >
        <span className="history-toolbar-cell-btn__inner inline-flex items-center justify-center gap-1 min-w-0 max-w-full">
          <span className="history-toolbar-cell-btn__icon shrink-0 w-4 h-4 flex items-center justify-center">
            {avatarPath ? (
              <AvatarImage filePath={avatarPath} fallbackIcon={icon} size={14} cacheKey={avatarCacheKey} />
            ) : icon ? (
              <Icon name={icon} size={14} className="shrink-0" />
            ) : (
              <span className="text-[11px] font-semibold leading-none text-muted">{fallback ?? "?"}</span>
            )}
          </span>
          {label ? (
            <span className="history-toolbar-cell-btn__label text-[9px] font-medium leading-tight truncate max-w-[4.25rem]">
              {label}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${HISTORY_TOOLBAR_BTN} gap-1 ${label ? "px-2" : ""} ${activeClass} ${className}`.trim()}
      style={accentStyle}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {avatarPath ? (
        <AvatarImage filePath={avatarPath} fallbackIcon={icon} size={16} cacheKey={avatarCacheKey} />
      ) : icon ? (
        <Icon name={icon} size={16} className="shrink-0" />
      ) : null}
      {label ? (
        <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
      ) : icon ? null : (
        <span className="text-[11px] font-semibold leading-none">{fallback ?? "?"}</span>
      )}
    </button>
  );
}
