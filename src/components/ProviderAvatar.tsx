import { useState } from "react";
import type { IconSlug } from "../lib/icons";
import { providerBadgeMeta } from "../lib/providerBadge";
import type { TtsProvider } from "../types";
import AvatarImage from "./avatars/AvatarImage";

interface Props {
  provider: TtsProvider | string;
  filePath?: string | null;
  fallbackIcon?: IconSlug;
  fallbackLabel?: string;
  size?: number;
  className?: string;
  title?: string;
  cacheKey?: number;
  /** Show provider logo badge. Default true. */
  showProviderBadge?: boolean;
  badgePosition?: "bottom-right" | "top-left";
}

export default function ProviderAvatar({
  provider,
  filePath,
  fallbackIcon,
  fallbackLabel,
  size = 32,
  className = "",
  title,
  cacheKey,
  showProviderBadge = true,
  badgePosition = "bottom-right",
}: Props) {
  const badge = providerBadgeMeta(provider);
  const [badgeImgFailed, setBadgeImgFailed] = useState(false);
  const badgeSize = Math.max(14, Math.round(size * 0.42));
  const badgeFont = Math.max(7, Math.round(badgeSize * 0.52));
  const badgePosClass =
    badgePosition === "top-left"
      ? "top-0 left-0 -translate-x-0.5 -translate-y-0.5"
      : "-bottom-0.5 -right-0.5";
  const iconPad = Math.max(1, Math.round(badgeSize * 0.12));

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`.trim()}
      title={title}
      style={{ width: size, height: size }}
    >
      <AvatarImage
        filePath={filePath}
        fallbackIcon={fallbackIcon}
        fallbackLabel={fallbackLabel}
        size={size}
        cacheKey={cacheKey}
        className="shrink-0"
      />
      {showProviderBadge ? (
        <span
          className={`absolute inline-flex items-center justify-center rounded-full shadow-sm overflow-hidden ${badgePosClass} ${badge.className}`}
          style={{ width: badgeSize, height: badgeSize }}
          title={badge.title}
          aria-hidden
        >
          {badgeImgFailed ? (
            <span
              className="font-bold leading-none text-muted"
              style={{ fontSize: badgeFont }}
            >
              {badge.letter}
            </span>
          ) : (
            <img
              src={badge.iconUrl}
              alt=""
              className="block h-full w-full object-contain"
              style={{ padding: iconPad }}
              draggable={false}
              onError={() => setBadgeImgFailed(true)}
            />
          )}
        </span>
      ) : null}
    </span>
  );
}
