/** Shared dismiss state between main window and playback popup. */
let dismissedGenerationId: string | null = null;

export function dismissPlaybackToastForGeneration(id: string): void {
  dismissedGenerationId = id;
}

export function clearPlaybackToastDismiss(): void {
  dismissedGenerationId = null;
}

export function isPlaybackToastDismissed(generationId: string): boolean {
  return dismissedGenerationId === generationId;
}

export function resetDismissIfNewGeneration(generationId: string | undefined): void {
  if (!generationId) return;
  if (dismissedGenerationId != null && dismissedGenerationId !== generationId) {
    dismissedGenerationId = null;
  }
}
