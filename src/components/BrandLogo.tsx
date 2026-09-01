import { useSyncExternalStore } from "react";

type Props = {
  size?: number;
  className?: string;
};

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function BrandLogo({ size = 16, className }: Props) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  if (reducedMotion) {
    return (
      <img
        src="/brand/logo-spin-poster.png"
        alt=""
        className={className}
        width={size}
        height={size}
        draggable={false}
      />
    );
  }

  return (
    <video
      className={className}
      width={size}
      height={size}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      poster="/brand/logo-spin-poster.png"
      aria-hidden
    >
      <source src="/brand/logo-spin.webm" type="video/webm" />
    </video>
  );
}
