import chevronDownUrl from "@vibelife/icons/terminal-collapse/default/terminal-collapse.svg?url";
import refreshUrl from "@vibelife/icons/refresh/default/refresh.svg?url";
import folderUrl from "@vibelife/icons/folder/default/folder.svg?url";
import pauseUrl from "@vibelife/icons/pause/default/pause.svg?url";
import playUrl from "@vibelife/icons/play/default/play.svg?url";
import saveUrl from "@vibelife/icons/save/default/save.svg?url";
import spinnerUrl from "@vibelife/icons/spinner/default/spinner.svg?url";
import xCircleUrl from "@vibelife/icons/x-circle/default/x-circle.svg?url";

/** Slugi z Icons/icons — zawsze wariant `default`. */
export type IconSlug =
  | "play"
  | "pause"
  | "spinner"
  | "save"
  | "x-circle"
  | "folder"
  | "chevron-down"
  | "reload";

export const ICON_SRC: Record<IconSlug, string> = {
  play: playUrl,
  pause: pauseUrl,
  spinner: spinnerUrl,
  save: saveUrl,
  "x-circle": xCircleUrl,
  folder: folderUrl,
  "chevron-down": chevronDownUrl,
  reload: refreshUrl,
};
