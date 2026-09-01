import { invoke } from "@tauri-apps/api/core";

export type PlaybackControlAction =
  | "toggle"
  | "restart"
  | "seek"
  | "setVolume"
  | "toggleMute"
  | "setPositionLock"
  | "pin"
  | "unpin";

export interface PlaybackControlRequest {
  action: PlaybackControlAction;
  seconds?: number;
  volume?: number;
  enabled?: boolean;
  generationId?: string;
}

export async function playbackToastControl(req: PlaybackControlRequest): Promise<void> {
  await invoke("playback_toast_control", {
    req: {
      action: req.action,
      seconds: req.seconds,
      volume: req.volume,
      enabled: req.enabled,
      generationId: req.generationId,
    },
  });
}
