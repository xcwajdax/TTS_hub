import { formatTime } from "./formatTime";

export interface TimelineTick {
  sec: number;
  xRatio: number;
  label: string;
}

const NICE_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;
const MIN_TICK_PX = 60;

export function pickTickIntervalSec(durationSec: number, widthPx: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || widthPx <= 0) return 1;
  const maxTicks = Math.max(2, Math.floor(widthPx / MIN_TICK_PX));
  const raw = durationSec / maxTicks;
  for (const interval of NICE_INTERVALS) {
    if (interval >= raw) return interval;
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1];
}

export function buildTimelineTicks(durationSec: number, widthPx: number): TimelineTick[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return [{ sec: 0, xRatio: 0, label: formatTime(0) }];
  }

  const interval = pickTickIntervalSec(durationSec, widthPx);
  const ticks: TimelineTick[] = [];

  for (let sec = 0; sec <= durationSec + 0.001; sec += interval) {
    const clamped = Math.min(sec, durationSec);
    ticks.push({
      sec: clamped,
      xRatio: clamped / durationSec,
      label: formatTime(clamped),
    });
  }

  const last = ticks[ticks.length - 1];
  if (!last || Math.abs(last.sec - durationSec) > 0.05) {
    ticks.push({
      sec: durationSec,
      xRatio: 1,
      label: formatTime(durationSec),
    });
  }

  return ticks;
}
