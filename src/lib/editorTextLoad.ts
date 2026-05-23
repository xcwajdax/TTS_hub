/** Loads plain text into the main generation editor (block doc + playback context). */
export const EDITOR_TEXT_LOAD_EVENT = "tts-hub:editor-text-load";

export interface EditorTextLoadDetail {
  text: string;
}

export function loadPlainTextIntoEditor(text: string): void {
  window.dispatchEvent(
    new CustomEvent<EditorTextLoadDetail>(EDITOR_TEXT_LOAD_EVENT, {
      detail: { text },
    }),
  );
}
