/** Gemini TTS paid-tier rates (Standard). Source: pricing-0.md / Google docs, May 2026. */
export type PriceCurrency = "PLN" | "USD";

export interface GeminiTtsRates {
  inputTextPer1M: number;
  outputAudioPer1M: number;
  currency: PriceCurrency;
}

const RATES: Record<string, GeminiTtsRates> = {
  "gemini-3.1-flash-tts-preview": {
    inputTextPer1M: 1.0,
    outputAudioPer1M: 20.0,
    currency: "PLN",
  },
  "gemini-2.5-flash-preview-tts": {
    inputTextPer1M: 0.5,
    outputAudioPer1M: 10.0,
    currency: "PLN",
  },
  "gemini-2.5-pro-preview-tts": {
    inputTextPer1M: 1.0,
    outputAudioPer1M: 20.0,
    currency: "PLN",
  },
};

/** Audio output ≈ 25 tokens per second (Google TTS docs). */
export const AUDIO_TOKENS_PER_SECOND = 25;

export function getGeminiTtsRates(model: string): GeminiTtsRates | null {
  return RATES[model] ?? null;
}

export function estimateTextTokens(charCount: number): number {
  return Math.max(1, Math.ceil(charCount / 4));
}

export function estimateAudioTokens(durationMs?: number | null, charCount?: number): number {
  if (durationMs != null && durationMs > 0) {
    return Math.ceil((durationMs / 1000) * AUDIO_TOKENS_PER_SECOND);
  }
  const chars = charCount ?? 0;
  const seconds = Math.max(1, chars / 12);
  return Math.ceil(seconds * AUDIO_TOKENS_PER_SECOND);
}

export interface CostEstimate {
  amount: number;
  currency: PriceCurrency;
  promptTokens: number;
  outputTokens: number;
  label: string;
}

export function estimateGenerationCost(
  model: string,
  synthCharCount: number,
  options?: {
    promptTokens?: number | null;
    outputTokens?: number | null;
    durationMs?: number | null;
  },
): CostEstimate | null {
  const rates = getGeminiTtsRates(model);
  if (!rates) return null;

  const promptTokens =
    options?.promptTokens && options.promptTokens > 0
      ? options.promptTokens
      : estimateTextTokens(synthCharCount);
  const outputTokens =
    options?.outputTokens && options.outputTokens > 0
      ? options.outputTokens
      : estimateAudioTokens(options?.durationMs, synthCharCount);

  const inputCost = (promptTokens / 1_000_000) * rates.inputTextPer1M;
  const outputCost = (outputTokens / 1_000_000) * rates.outputAudioPer1M;
  const amount = inputCost + outputCost;

  const sym = rates.currency === "PLN" ? "zł" : "$";
  const label =
    amount < 0.01
      ? `~<0,01 ${sym}`
      : `~${amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${sym}`;

  return {
    amount,
    currency: rates.currency,
    promptTokens,
    outputTokens,
    label,
  };
}

export const GEMINI_PRICING_URL =
  "https://ai.google.dev/gemini-api/docs/pricing?hl=pl";
