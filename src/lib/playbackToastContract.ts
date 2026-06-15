import type { IconSlug } from "./icons";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation, GenerationSource, JobStatus } from "../types";
import type { Phase } from "../context/JobsContext";

export const PLAYBACK_TOAST_WINDOW_LABEL = "playback-toast";
export const MAIN_WINDOW_LABEL = "main";

export const PlaybackToastEvents = {
  show: "playback-toast:show",
  showGeneration: "playback-toast:show-generation",
  hide: "playback-toast:hide",
  ready: "playback-toast:ready",
  ping: "playback-toast:ping",
  modelPatch: "playback-toast:model-patch",
  vizFrame: "playback-viz:frame",
  togglePlay: "playback-toast:toggle-play",
  restart: "playback-toast:restart",
  setVolume: "playback-toast:set-volume",
  toggleMute: "playback-toast:toggle-mute",
  archive: "playback-toast:archive",
  snooze: "playback-toast:snooze",
  userHide: "playback-toast:user-hide",
  close: "playback-toast:close",
  cancelJob: "playback-toast:cancel-job",
} as const;

export type PlaybackToastMode = "playback" | "generation";

export interface PlaybackToastSourceView {
  label: string;
  color: string;
  icon: IconSlug;
  avatarPath: string | null;
}

export interface PlaybackToastViewModel {
  generation: Generation;
  title: string;
  profileName: string | null;
  voiceAvatarPath: string | null;
  provider: string;
  source: PlaybackToastSourceView;
  isArchived: boolean;
  queueLength?: number;
}

export interface GenerationToastJobView {
  id: string;
  title: string;
  subtitle: string;
  status: JobStatus;
  phase: Phase;
  provider: string | null;
  elapsedMs: number;
  etaMs: number;
  error: string | null;
  voiceProfileId: string | null;
  source?: GenerationSource;
  originKind: string | null;
  originUserName: string | null;
  queuePosition: number;
  queueTotal: number;
}

export interface GenerationToastViewModel {
  jobs: GenerationToastJobView[];
  runningCount: number;
  queuedCount: number;
}

export interface GenerationToastShowPayload {
  model: GenerationToastViewModel;
  voiceProfiles: TtsVoiceProfile[];
}

export interface PlaybackToastModelPatch {
  isArchived?: boolean;
}

export interface PlaybackVizFramePayload {
  levels: number[];
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  loading: boolean;
}

export interface PlaybackToastSetVolumePayload {
  volume: number;
}

export interface PlaybackToastSnoozePayload {
  delayMs: number;
}

export interface PlaybackToastCancelJobPayload {
  jobId: string;
}

/** @deprecated Use PlaybackToastViewModel */
export type PlaybackToastShowPayload = PlaybackToastViewModel;

export const PLAYBACK_SNOOZE_PRESETS_MS = [
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
] as const;

export function snoozePresetLabel(delayMs: number): string {
  const min = Math.round(delayMs / 60_000);
  return `${min} min`;
}
