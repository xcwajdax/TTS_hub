import { estimateGenerationCost } from "../lib/geminiPricing";
import { getGenerationTokenUsage } from "../lib/tokenUsage";
import type { Generation } from "../types";

interface Props {
  gen: Generation;
  className?: string;
}

export default function TokenCostLabel({ gen, className = "" }: Props) {
  const usage = getGenerationTokenUsage(gen);
  if (!usage) return null;

  const cost =
    gen.provider === "google" || gen.provider == null
      ? estimateGenerationCost(gen.model, gen.input_chars ?? 0, {
          promptTokens: gen.prompt_tokens,
          outputTokens: gen.output_tokens,
          durationMs: gen.duration_ms,
        })
      : null;

  return (
    <span
      className={`tag tabular-nums shrink-0 ${className}`.trim()}
      title={
        cost
          ? `${usage.title} · Szac. koszt: ${cost.label} (${cost.promptTokens} + ${cost.outputTokens} tok.)`
          : usage.title
      }
    >
      {usage.primary}
      {usage.detail ? (
        <span className="text-muted/80 font-normal ml-0.5">{usage.detail}</span>
      ) : null}
      {cost ? (
        <span className="text-muted/80 font-normal ml-1">· {cost.label}</span>
      ) : null}
    </span>
  );
}
