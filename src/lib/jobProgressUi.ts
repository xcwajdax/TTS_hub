import { PHASE_LABEL, type Phase } from "../context/JobsContext";
export function fmtJobTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
}

export function phaseLabelForProvider(phase: Phase, provider?: string | null): string {
  if (phase === "requesting") {
    const p = (provider ?? "google").toLowerCase();
    if (p === "minimax") return "Czekam na Minimax…";
    if (p === "voicebox") return "Czekam na Voice Box…";
    return "Czekam na Google…";
  }
  return PHASE_LABEL[phase];
}

export function providerDisplayName(provider?: string | null): string {
  const p = (provider ?? "google").toLowerCase();
  if (p === "minimax") return "Minimax";
  if (p === "voicebox") return "Voice Box";
  return "Google";
}

export function jobProgressPercent(
  active: boolean,
  elapsedMs: number,
  etaMs: number,
  status: string,
): number {
  if (!active) return status === "done" ? 100 : 0;
  if (etaMs > 0) return Math.min(99, Math.round((elapsedMs / etaMs) * 100));
  return status === "queued" ? 8 : 20;
}
