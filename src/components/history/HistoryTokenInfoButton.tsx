import { estimateGenerationCost } from "../../lib/geminiPricing";
import { getGenerationTokenUsage } from "../../lib/tokenUsage";
import type { Generation } from "../../types";
import Icon from "../Icon";

const ICON = 14;

interface Props {
  gen: Generation;
}

export default function HistoryTokenInfoButton({ gen }: Props) {
  const usage = getGenerationTokenUsage(gen);
  const cost =
    gen.provider === "google" || gen.provider == null
      ? estimateGenerationCost(gen.model, gen.input_chars ?? 0, {
          promptTokens: gen.prompt_tokens,
          outputTokens: gen.output_tokens,
          durationMs: gen.duration_ms,
        })
      : null;

  if (!usage && !cost) {
    return (
      <span
        className="history-meta-icon history-meta-icon--muted inline-flex items-center justify-center"
        title="Brak danych o tokenach"
        aria-hidden
      >
        <Icon name="info" size={ICON} className="opacity-40" />
      </span>
    );
  }

  const lines: string[] = [];
  if (usage) lines.push(usage.title);
  if (cost) {
    lines.push(`Szac. koszt: ${cost.label}`);
    lines.push(`Tokeny: ${cost.promptTokens} wej. + ${cost.outputTokens} wyj.`);
  }

  return (
    <button
      type="button"
      className="history-meta-icon inline-flex items-center justify-center rounded hover:bg-black/10 transition-colors"
      title={lines.join("\n")}
      aria-label="Koszt i tokeny"
      onClick={(e) => e.stopPropagation()}
    >
      <Icon name="info" size={ICON} />
    </button>
  );
}
