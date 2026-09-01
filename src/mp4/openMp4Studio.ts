/**
 * MP4 studio navigation helper.
 *
 * Mirrors `editorTextLoad.ts`: callers dispatch a window event to ask
 * `App.tsx` to switch to the MP4 tab and load the studio with a chosen
 * generation. A module-level pending slot holds the id if `App` hasn't
 * mounted the listener yet (e.g. during early startup).
 */

export const MP4_STUDIO_OPEN_EVENT = "tts-hub:mp4-studio-open";

export interface Mp4StudioOpenDetail {
  generationId: string;
}

let pendingGenerationId: string | null = null;

export function takePendingMp4StudioGenerationId(): string | null {
  const id = pendingGenerationId;
  pendingGenerationId = null;
  return id;
}

/** Dispatch a window event so App can switch to the MP4 tab. */
export function openMp4Studio(generationId: string): void {
  pendingGenerationId = generationId;
  window.dispatchEvent(
    new CustomEvent<Mp4StudioOpenDetail>(MP4_STUDIO_OPEN_EVENT, {
      detail: { generationId },
    }),
  );
}
