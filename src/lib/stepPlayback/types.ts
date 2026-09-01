export type StepPlaybackMode = "off" | "auto" | "force";

export interface StepPlaybackSettings {
  mode: StepPlaybackMode;
  min_steps: number;
  synth_per_step: boolean;
  auto_advance: boolean;
  pause_between_ms: number;
  show_intro: boolean;
}

export interface PlaybackStep {
  index: number;
  label: string;
  text: string;
  char_start: number;
  char_end: number;
}

export interface StepParseResult {
  steps: PlaybackStep[];
  intro?: string;
  confidence: number;
  source: "ordered_list" | "numbered_lines" | "manual";
}

export interface PlaybackStepView extends PlaybackStep {
  startMs: number;
  endMs: number;
}

export interface StepTimings {
  steps: PlaybackStepView[];
  intro?: string;
}
