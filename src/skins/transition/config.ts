import type { SkinManifest } from "../types";
import type { SkinTransitionConfig, SkinTransitionPattern } from "./types";

export const SKIN_TRANSITIONS_ENABLED_KEY = "tts-hub-skin-transitions-enabled";
export const SKIN_TRANSITIONS_FORCE_KEY = "tts-hub-skin-transitions-force";

const DEFAULTS: SkinTransitionConfig = {
  enabled: true,
  pattern: "bricks",
  durationMs: 3800,
  waveSpeed: 400,
  falloff: 0.42,
  noise: 0.18,
  lift: 36,
  captureScale: 0.85,
  matrixGlyphs: false,
};

const BUILTIN_OVERRIDES: Record<string, Partial<SkinTransitionConfig>> = {
  vibelife: {
    pattern: "bricks",
    durationMs: 3600,
    waveSpeed: 400,
    falloff: 0.4,
    noise: 0.16,
    lift: 32,
  },
  matrix: {
    pattern: "matrix-columns",
    durationMs: 4200,
    waveSpeed: 360,
    falloff: 0.45,
    noise: 0.24,
    lift: 40,
    matrixGlyphs: true,
  },
  "light-zen": {
    pattern: "squares",
    durationMs: 3200,
    waveSpeed: 420,
    falloff: 0.36,
    noise: 0.12,
    lift: 26,
  },
};

export function isSkinTransitionsForceEnabled(): boolean {
  try {
    return localStorage.getItem(SKIN_TRANSITIONS_FORCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSkinTransitionsForceEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SKIN_TRANSITIONS_FORCE_KEY, enabled ? "true" : "false");
  } catch {
    /* private mode */
  }
}

export function isSkinTransitionsGloballyEnabled(): boolean {
  try {
    return localStorage.getItem(SKIN_TRANSITIONS_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setSkinTransitionsGloballyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SKIN_TRANSITIONS_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    /* private mode */
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function normalizeSkinTransitionConfig(
  raw: unknown,
  skinId: string,
): SkinTransitionConfig {
  const base = {
    ...DEFAULTS,
    ...(BUILTIN_OVERRIDES[skinId] ?? {}),
  };

  if (!raw || typeof raw !== "object") return base;

  const m = raw as Record<string, unknown>;
  const pattern = m.pattern;
  const validPatterns: SkinTransitionPattern[] = ["bricks", "squares", "matrix-columns"];

  return {
    enabled: typeof m.enabled === "boolean" ? m.enabled : base.enabled,
    pattern:
      typeof pattern === "string" && validPatterns.includes(pattern as SkinTransitionPattern)
        ? (pattern as SkinTransitionPattern)
        : base.pattern,
    durationMs:
      typeof m.durationMs === "number" && m.durationMs > 0
        ? Math.round(m.durationMs)
        : base.durationMs,
    waveSpeed:
      typeof m.waveSpeed === "number" && m.waveSpeed > 0 ? m.waveSpeed : base.waveSpeed,
    falloff: typeof m.falloff === "number" ? clamp01(m.falloff) : base.falloff,
    noise: typeof m.noise === "number" ? clamp01(m.noise) : base.noise,
    lift: typeof m.lift === "number" && m.lift >= 0 ? m.lift : base.lift,
    captureScale:
      typeof m.captureScale === "number"
        ? Math.min(1, Math.max(0.25, m.captureScale))
        : base.captureScale,
    matrixGlyphs:
      typeof m.matrixGlyphs === "boolean" ? m.matrixGlyphs : base.matrixGlyphs,
  };
}

/** Config used when transitioning *to* this skin (target manifest). */
export function getTransitionConfigForSkin(
  manifest: SkinManifest | undefined,
  skinId: string,
): SkinTransitionConfig {
  const fromManifest = (manifest as SkinManifest & { transition?: unknown })?.transition;
  return normalizeSkinTransitionConfig(fromManifest, skinId);
}

export function shouldPlaySkinTransition(config: SkinTransitionConfig): boolean {
  if (!config.enabled) return false;
  if (!isSkinTransitionsGloballyEnabled()) return false;
  if (
    !isSkinTransitionsForceEnabled() &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  return true;
}
