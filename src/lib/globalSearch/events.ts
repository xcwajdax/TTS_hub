export const GLOBAL_SEARCH_OPEN_EVENT = "tts-hub:global-search-open";

export function openGlobalSearch(): void {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_OPEN_EVENT));
}
