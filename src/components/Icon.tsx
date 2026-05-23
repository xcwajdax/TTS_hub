import type { IconSlug } from "../lib/icons";
import { ICON_SRC } from "../lib/icons";

interface Props {
  name: IconSlug;
  size?: number;
  className?: string;
  spin?: boolean;
  title?: string;
}

export default function Icon({ name, size = 32, className = "", spin = false, title }: Props) {
  return (
    <img
      src={ICON_SRC[name]}
      alt=""
      width={size}
      height={size}
      draggable={false}
      title={title}
      className={`vl-icon block shrink-0 ${spin ? "animate-spin" : ""} ${className}`.trim()}
      aria-hidden={title ? undefined : true}
    />
  );
}
