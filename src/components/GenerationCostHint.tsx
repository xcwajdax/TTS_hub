import { estimateGenerationCost, GEMINI_PRICING_URL } from "../lib/geminiPricing";

interface Props {
  model: string;
  synthCharCount: number;
  className?: string;
}

export default function GenerationCostHint({ model, synthCharCount, className = "" }: Props) {
  if (synthCharCount <= 0) return null;
  const est = estimateGenerationCost(model, synthCharCount);
  if (!est) return null;

  return (
    <span
      className={`text-[11px] text-muted tabular-nums ${className}`.trim()}
      title={`Szacunek (płatny tier): wejście ~${est.promptTokens.toLocaleString("pl-PL")} tok., audio ~${est.outputTokens.toLocaleString("pl-PL")} tok. Cennik: ${GEMINI_PRICING_URL}`}
    >
      Szac. koszt:{" "}
      <span className="text-ink/90">{est.label}</span>
      {" · "}
      <a
        href={GEMINI_PRICING_URL}
        className="underline hover:text-accent2"
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        cennik
      </a>
    </span>
  );
}
