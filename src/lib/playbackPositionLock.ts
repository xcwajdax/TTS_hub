const LOCK_ENABLED_KEY = "tts-hub.playback.positionLock.enabled";
const POSITIONS_KEY = "tts-hub.playback.positionLock.positions";

type PositionMap = Record<string, number>;

function readPositions(): PositionMap {
  try {
    const raw = window.localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PositionMap = {};
    for (const [id, sec] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof sec === "number" && Number.isFinite(sec) && sec >= 0) {
        out[id] = sec;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writePositions(map: PositionMap): void {
  try {
    window.localStorage.setItem(POSITIONS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function isPlaybackPositionLockEnabled(): boolean {
  try {
    return window.localStorage.getItem(LOCK_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPlaybackPositionLockEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(LOCK_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function getSavedPlaybackPosition(generationId: string): number | null {
  if (!isPlaybackPositionLockEnabled()) return null;
  const sec = readPositions()[generationId];
  return sec != null && Number.isFinite(sec) ? sec : null;
}

export function savePlaybackPosition(generationId: string, seconds: number): void {
  if (!isPlaybackPositionLockEnabled()) return;
  if (!Number.isFinite(seconds) || seconds < 0) return;
  const map = readPositions();
  map[generationId] = seconds;
  writePositions(map);
}

export function clearPlaybackPosition(generationId: string): void {
  const map = readPositions();
  if (!(generationId in map)) return;
  delete map[generationId];
  writePositions(map);
}
