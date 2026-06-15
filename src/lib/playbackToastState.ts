/** Shared dismiss state between main window and playback popup. */
let dismissedGenerationId: string | null = null;
/** When true, dismiss clears on next play (close); when false, sticky until another generation (hide). */
let dismissUntilReplay = false;

export function dismissPlaybackToastForGeneration(id: string, untilReplay = false): void {
  dismissedGenerationId = id;
  dismissUntilReplay = untilReplay;
}

export function clearPlaybackToastDismiss(): void {
  dismissedGenerationId = null;
  dismissUntilReplay = false;
}

export function isPlaybackToastDismissed(generationId: string): boolean {
  return dismissedGenerationId === generationId;
}

export function clearDismissOnPlaybackStart(generationId: string | undefined): void {
  if (!generationId) return;
  if (dismissedGenerationId === generationId && dismissUntilReplay) {
    clearPlaybackToastDismiss();
  }
}

export function resetDismissIfNewGeneration(generationId: string | undefined): void {
  if (!generationId) return;
  if (dismissedGenerationId != null && dismissedGenerationId !== generationId) {
    clearPlaybackToastDismiss();
  }
}
