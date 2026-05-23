import type { IconSlug } from "../../lib/icons";
import { avatarSrc } from "../../lib/avatars";
import Icon from "../Icon";

interface Props {
  filePath?: string | null;
  fallbackIcon?: IconSlug;
  fallbackLabel?: string;
  size?: number;
  className?: string;
  title?: string;
  cacheKey?: number;
}

export default function AvatarImage({
  filePath,
  fallbackIcon,
  fallbackLabel,
  size = 32,
  className = "",
  title,
  cacheKey,
}: Props) {
  if (filePath) {
    return (
      <img
        src={avatarSrc(filePath, cacheKey)}
        alt=""
        width={size}
        height={size}
        draggable={false}
        title={title}
        className={`block shrink-0 rounded-full object-cover bg-panel2 ${className}`.trim()}
        style={{ width: size, height: size }}
      />
    );
  }

  if (fallbackIcon) {
    return <Icon name={fallbackIcon} size={size} className={className} title={title} />;
  }

  const letter = (fallbackLabel ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-panel2 text-muted font-semibold ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      aria-hidden={title ? undefined : true}
    >
      {letter}
    </span>
  );
}
