export const PLUGINS_CHANGED = "plugins:changed";

export function notifyPluginsChanged(): void {
  window.dispatchEvent(new CustomEvent(PLUGINS_CHANGED));
}
