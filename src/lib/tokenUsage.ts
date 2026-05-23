import type { Generation } from "../types";

export function formatTokenInt(n: number): string {
  return n.toLocaleString("pl-PL");
}

export interface TokenUsageDisplay {
  primary: string;
  detail?: string;
  title: string;
}

/** Compact token / input-char label for a single generation (null if no usage data). */
export function getGenerationTokenUsage(gen: Generation): TokenUsageDisplay | null {
  const prompt = gen.prompt_tokens ?? 0;
  const output = gen.output_tokens ?? 0;
  const total =
    gen.total_tokens != null && gen.total_tokens > 0
      ? gen.total_tokens
      : prompt + output > 0
        ? prompt + output
        : null;

  if (total != null && total > 0) {
    const detail =
      prompt > 0 || output > 0
        ? `↑${formatTokenInt(prompt)} ↓${formatTokenInt(output)}`
        : undefined;
    return {
      primary: `${formatTokenInt(total)} tok.`,
      detail,
      title: `Tokeny: łącznie ${formatTokenInt(total)}, wejście ${formatTokenInt(prompt)}, wyjście ${formatTokenInt(output)}`,
    };
  }

  if (gen.input_chars != null && gen.input_chars > 0) {
    const chars = formatTokenInt(gen.input_chars);
    const voicebox = gen.provider === "voicebox";
    return {
      primary: `${chars} zn.`,
      title: voicebox
        ? `Znaki wejściowe (Voice Box): ${chars}`
        : `Znaki wejściowe: ${chars}`,
    };
  }

  return null;
}
