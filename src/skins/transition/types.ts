export type SkinTransitionPattern = "bricks" | "squares" | "matrix-columns";

export interface SkinTransitionConfig {
  /** When false, skin switches instantly (global setting can also disable). */
  enabled: boolean;
  pattern: SkinTransitionPattern;
  durationMs: number;
  /** Wave front speed in px per second. */
  waveSpeed: number;
  /** Width of the flip zone (0–1, scaled internally). */
  falloff: number;
  /** Per-tile timing jitter (0–1). */
  noise: number;
  /** Max vertical lift for the dome (px). */
  lift: number;
  /** Snapshot scale vs viewport (0.25–1). */
  captureScale: number;
  /** Matrix rain glyphs on tile backs (matrix skin). */
  matrixGlyphs?: boolean;
}

export interface SkinTransitionOrigin {
  x: number;
  y: number;
}

export interface PlaySkinTransitionOptions {
  origin: SkinTransitionOrigin;
  fromSkinId: string;
  toSkinId: string;
  /** Called after snapshot — apply the new skin to the DOM. */
  applySkin: () => void | Promise<void>;
  config?: Partial<SkinTransitionConfig>;
}

export interface TransitionTile {
  x: number;
  y: number;
  w: number;
  h: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  seed: number;
}
