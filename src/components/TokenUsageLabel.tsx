import { getGenerationTokenUsage } from "../lib/tokenUsage";
import type { Generation } from "../types";

interface Props {
  gen: Generation;
  className?: string;
}

export default function TokenUsageLabel({ gen, className = "" }: Props) {
  const usage = getGenerationTokenUsage(gen);
  if (!usage) return null;

  return (
    <span
      className={`tag tabular-nums shrink-0 ${className}`.trim()}
      title={usage.title}
    >
      {usage.primary}
      {usage.detail ? (
        <span className="text-muted/80 font-normal ml-0.5">{usage.detail}</span>
      ) : null}
    </span>
  );
}
