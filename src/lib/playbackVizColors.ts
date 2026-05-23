/** Fixed palette for playback visualization — not affected by skins. */

export interface PlaybackVizColors {
  played: string;
  unplayed: string;
  empty: string;
  progressLine: string;
  equalizerActive: string;
  equalizerIdle: string;
}

export const PLAYBACK_VIZ_COLORS: PlaybackVizColors = {
  played: "rgba(124, 92, 255, 0.85)",
  unplayed: "rgba(138, 147, 166, 0.35)",
  empty: "rgba(138, 147, 166, 0.12)",
  progressLine: "rgba(34, 211, 238, 0.6)",
  equalizerActive: "rgba(124, 92, 255, 0.9)",
  equalizerIdle: "rgba(138, 147, 166, 0.22)",
};

export function getPlaybackVizColors(): PlaybackVizColors {
  return PLAYBACK_VIZ_COLORS;
}
