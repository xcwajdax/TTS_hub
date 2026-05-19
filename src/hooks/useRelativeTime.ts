import { useEffect, useState } from "react";

function formatRelative(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 5) return "teraz";
  if (diffSec < 60) return `${diffSec}s temu`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} dni temu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mies. temu`;
  return `${Math.floor(mo / 12)} lat temu`;
}

export function useRelativeTime(timestampMs: number): string {
  const [label, setLabel] = useState(() => formatRelative(timestampMs));
  useEffect(() => {
    const t = setInterval(() => setLabel(formatRelative(timestampMs)), 30_000);
    return () => clearInterval(t);
  }, [timestampMs]);
  return label;
}
