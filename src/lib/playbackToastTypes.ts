import type { Generation } from "../types";

export interface PlaybackVizFramePayload {
  levels: number[];
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  loading: boolean;
}

export interface PlaybackToastShowPayload {
  generation: Generation;
}
