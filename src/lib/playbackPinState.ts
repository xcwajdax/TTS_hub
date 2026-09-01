import type { PlaybackToastViewModel } from "./playbackToastContract";

export interface PinnedPlaybackSession {
  generationId: string;
  sessionId: string;
  model: PlaybackToastViewModel;
  pinnedAt: number;
  lastKnownTime: number;
  lastKnownDuration: number;
}

const PINNED_KEY = "tts-hub.playback.pinnedSessions";

function readPinned(): PinnedPlaybackSession[] {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PinnedPlaybackSession[]) : [];
  } catch {
    return [];
  }
}

function writePinned(sessions: PinnedPlaybackSession[]): void {
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(sessions));
  } catch {
    /* ignore */
  }
}

export function getPinnedSessions(): PinnedPlaybackSession[] {
  return readPinned();
}

export function isGenerationPinned(generationId: string): boolean {
  return readPinned().some((s) => s.generationId === generationId);
}

export function hasPinnedSessions(): boolean {
  return readPinned().length > 0;
}

export function pinSession(session: PinnedPlaybackSession): void {
  const list = readPinned().filter((s) => s.generationId !== session.generationId);
  list.unshift(session);
  writePinned(list.slice(0, 8));
}

export function unpinSession(generationId: string): void {
  writePinned(readPinned().filter((s) => s.generationId !== generationId));
}

export function updatePinnedProgress(
  generationId: string,
  currentTime: number,
  duration: number,
): void {
  const list = readPinned();
  const idx = list.findIndex((s) => s.generationId === generationId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], lastKnownTime: currentTime, lastKnownDuration: duration };
  writePinned(list);
}

export function clearPinnedForSession(sessionId: string): void {
  writePinned(readPinned().filter((s) => s.sessionId !== sessionId));
}

export function clearAllPinned(): void {
  writePinned([]);
}
