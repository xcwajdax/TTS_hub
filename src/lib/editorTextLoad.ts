import type { Generation } from "../types";

/** Loads plain text into the active editor tab (no generation link). */
export const EDITOR_TEXT_LOAD_EVENT = "tts-hub:editor-text-load";

/** Opens or switches to an editor tab linked to a history generation. */
export const EDITOR_OPEN_GENERATION_EVENT = "tts-hub:editor-open-generation";

/** Activates an existing editor tab by id (e.g. from global search). */
export const EDITOR_ACTIVATE_TAB_EVENT = "tts-hub:editor-activate-tab";

export interface EditorActivateTabDetail {
  tabId: string;
}

export interface EditorTextLoadDetail {
  text: string;
  generationId?: string | null;
}

export interface EditorOpenGenerationDetail {
  generation: Generation;
}

/** Set when TTS view is not mounted yet (e.g. user clicked history in Historia view). */
let pendingGenerationOpen: Generation | null = null;

/** Set when TTS view is not mounted yet (e.g. global search opened a draft). */
let pendingTabActivateId: string | null = null;

export function takePendingGenerationOpen(): Generation | null {
  const g = pendingGenerationOpen;
  pendingGenerationOpen = null;
  return g;
}

export function takePendingTabActivate(): string | null {
  const id = pendingTabActivateId;
  pendingTabActivateId = null;
  return id;
}

export function loadPlainTextIntoEditor(text: string): void {
  window.dispatchEvent(
    new CustomEvent<EditorTextLoadDetail>(EDITOR_TEXT_LOAD_EVENT, {
      detail: { text },
    }),
  );
}

/** Open generation in editor tab bar + playback timeline (MainPanel handles the event). */
export function openGenerationInEditor(g: Generation): void {
  pendingGenerationOpen = g;
  window.dispatchEvent(
    new CustomEvent<EditorOpenGenerationDetail>(EDITOR_OPEN_GENERATION_EVENT, {
      detail: { generation: g },
    }),
  );
}

export function activateEditorTab(tabId: string): void {
  pendingTabActivateId = tabId;
  window.dispatchEvent(
    new CustomEvent<EditorActivateTabDetail>(EDITOR_ACTIVATE_TAB_EVENT, {
      detail: { tabId },
    }),
  );
}
