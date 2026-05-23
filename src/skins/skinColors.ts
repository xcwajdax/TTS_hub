/** Read waveform / canvas colors from active CSS tokens. */

const FALLBACK_RGB = { r: 138, g: 147, b: 166 };

let colorProbe: HTMLDivElement | null = null;

function readCssVar(name: string): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || null;
}

/** Space-separated RGB triplet from skin tokens, e.g. "124 92 255". */
function parseRgbTriplet(raw: string): { r: number; g: number; b: number } | null {
  const base = raw.split("/")[0]?.trim() ?? raw;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return null;
  return { r, g, b };
}

/** Resolve any token value to rgb() via a hidden probe (hex, rgb(), triplets). */
function resolveTokenRgb(varName: string): { r: number; g: number; b: number } | null {
  const raw = readCssVar(varName);
  if (!raw) return null;

  const triplet = parseRgbTriplet(raw);
  if (triplet) return triplet;

  if (!colorProbe) {
    colorProbe = document.createElement("div");
    colorProbe.setAttribute("aria-hidden", "true");
    colorProbe.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none";
    document.body.appendChild(colorProbe);
  }

  const probe = colorProbe;
  probe.style.removeProperty("color");
  probe.style.removeProperty("background-color");

  if (/^#([0-9a-f]{3,8})$/i.test(raw) || raw.startsWith("rgb")) {
    probe.style.color = raw;
  } else {
    probe.style.color = `rgb(var(${varName}))`;
  }

  const computed = getComputedStyle(probe).color;
  const m = computed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function rgbaFromVar(varName: string, alpha: number, fallback = FALLBACK_RGB): string {
  const rgb = resolveTokenRgb(varName) ?? fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export interface SkinCanvasColors {
  played: string;
  unplayed: string;
  empty: string;
  progressLine: string;
}

export function readSkinCanvasColors(): SkinCanvasColors {
  return {
    played: rgbaFromVar("--color-accent", 0.85, { r: 124, g: 92, b: 255 }),
    unplayed: rgbaFromVar("--color-muted", 0.35),
    empty: rgbaFromVar("--color-muted", 0.12),
    progressLine: rgbaFromVar("--color-accent2", 0.6, { r: 34, g: 211, b: 238 }),
  };
}
