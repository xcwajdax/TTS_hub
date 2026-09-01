import type { PlaybackStepView, StepParseResult, StepTimings } from "./types";

export function computeStepTimings(
  parseResult: StepParseResult,
  durationMs: number,
  fullText?: string,
): StepTimings {
  const textLen = fullText?.length ?? parseResult.steps[parseResult.steps.length - 1]?.char_end ?? 1;
  const safeLen = Math.max(1, textLen);
  const totalMs = Math.max(1, durationMs);

  const steps: PlaybackStepView[] = parseResult.steps.map((step, idx) => {
    const startRatio = step.char_start / safeLen;
    const endRatio =
      idx < parseResult.steps.length - 1
        ? parseResult.steps[idx + 1].char_start / safeLen
        : 1;
    return {
      ...step,
      startMs: Math.round(startRatio * totalMs),
      endMs: Math.round(endRatio * totalMs),
    };
  });

  return { steps, intro: parseResult.intro };
}

export function stepAtTime(timings: StepTimings, currentTimeMs: number): PlaybackStepView | null {
  if (timings.steps.length === 0) return null;
  for (let i = timings.steps.length - 1; i >= 0; i--) {
    if (currentTimeMs >= timings.steps[i].startMs) return timings.steps[i];
  }
  return timings.steps[0];
}
