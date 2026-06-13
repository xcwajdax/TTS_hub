/** Whether the toast should stay visible for this audio element. */
export function isTrackFinished(audio: HTMLAudioElement, playing: boolean): boolean {
  if (audio.ended) return true;

  const duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) return false;

  const nearEnd = audio.currentTime >= duration - 0.15;
  return nearEnd && !playing;
}

export function isPlaybackToastActive(
  genId: string | null,
  audio: HTMLAudioElement | null,
  playing: boolean,
): boolean {
  if (!genId || !audio) return false;
  return !isTrackFinished(audio, playing);
}

/** Main is in background when minimized, hidden, or another app has focus. */
export function isMainInBackground(
  focused: boolean,
  minimized: boolean,
  visible: boolean,
): boolean {
  return minimized || !focused || !visible;
}
