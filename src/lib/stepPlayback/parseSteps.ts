import type { PlaybackStep, StepParseResult } from "./types";

const NUMBERED_LINE =
  /^\s*(\d+)[\.\):\-]\s+(\S.*)$/;
const KEYWORD_LINE =
  /^\s*(?:krok|step|punkt|etap)\s+(\d+)[\.\):\-]?\s*(.*)$/i;

function scoreSequential(nums: number[]): number {
  if (nums.length < 2) return 0;
  let sequential = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) sequential++;
  }
  return sequential / (nums.length - 1);
}

function parseNumberedLines(text: string, minSteps: number): StepParseResult | null {
  const lines = text.split(/\r?\n/);
  const matches: { num: number; body: string; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(NUMBERED_LINE) ?? line.match(KEYWORD_LINE);
    if (!m) continue;
    const num = Number(m[1]);
    const body = (m[2] ?? "").trim();
    if (!body) continue;
    matches.push({ num, body, lineIndex: i });
  }

  if (matches.length < minSteps) return null;

  const seqScore = scoreSequential(matches.map((m) => m.num));
  let confidence = 0.2;
  if (seqScore >= 0.5) confidence += 0.4;
  if (matches.length >= 3) confidence += 0.3;
  if (matches.every((m) => NUMBERED_LINE.test(lines[m.lineIndex]) || KEYWORD_LINE.test(lines[m.lineIndex]))) {
    confidence += 0.2;
  }

  const introLines = lines.slice(0, matches[0].lineIndex).join("\n").trim();
  const steps: PlaybackStep[] = matches.map((m, idx) => {
    const lineStart = lines.slice(0, m.lineIndex).join("\n").length + (m.lineIndex > 0 ? 1 : 0);
    const char_start = lineStart;
    const char_end = char_start + lines[m.lineIndex].length;
    const label =
      m.body.length > 60 ? `${m.body.slice(0, 57).trim()}…` : m.body;
    return {
      index: idx + 1,
      label,
      text: m.body,
      char_start,
      char_end,
    };
  });

  return {
    steps,
    intro: introLines || undefined,
    confidence: Math.min(1, confidence),
    source: "numbered_lines",
  };
}

export interface ParseStepsOptions {
  minSteps?: number;
  mode?: "auto" | "force";
  confidenceThreshold?: number;
}

export function parseSteps(
  text: string,
  options: ParseStepsOptions = {},
): StepParseResult | null {
  const minSteps = options.minSteps ?? 2;
  const mode = options.mode ?? "auto";
  const threshold = options.confidenceThreshold ?? 0.6;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const result = parseNumberedLines(trimmed, mode === "force" ? 1 : minSteps);
  if (!result) return mode === "force" && trimmed ? fallbackSingleStep(trimmed) : null;
  if (mode === "force") return result;
  if (result.confidence < threshold && result.steps.length < minSteps) return null;
  return result;
}

function fallbackSingleStep(text: string): StepParseResult {
  return {
    steps: [
      {
        index: 1,
        label: text.length > 60 ? `${text.slice(0, 57).trim()}…` : text,
        text,
        char_start: 0,
        char_end: text.length,
      },
    ],
    confidence: 1,
    source: "manual",
  };
}

export function findActiveStepIndex(
  timings: { startMs: number; endMs: number }[],
  currentTimeMs: number,
): number {
  for (let i = timings.length - 1; i >= 0; i--) {
    if (currentTimeMs >= timings[i].startMs) return i;
  }
  return 0;
}
