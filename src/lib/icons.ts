import chevronDownUrl from "@vibelife/icons/terminal-collapse/default/terminal-collapse.svg?url";
import refreshUrl from "@vibelife/icons/refresh/default/refresh.svg?url";
import folderUrl from "@vibelife/icons/folder/default/folder.svg?url";
import folderFilledUrl from "@vibelife/icons/folder-filled/default/folder-filled.svg?url";
import pauseUrl from "@vibelife/icons/pause/default/pause.svg?url";
import playUrl from "@vibelife/icons/play/default/play.svg?url";
import saveUrl from "@vibelife/icons/save/default/save.svg?url";
import spinnerUrl from "@vibelife/icons/spinner/default/spinner.svg?url";
import xCircleUrl from "@vibelife/icons/x-circle/default/x-circle.svg?url";
import undoUrl from "@vibelife/icons/undo/default/undo.svg?url";
import redoUrl from "@vibelife/icons/redo/default/redo.svg?url";
import minimizeUrl from "@vibelife/icons/minimize/default/minimize.svg?url";
import closeUrl from "@vibelife/icons/close/default/close.svg?url";
import alertUrl from "@vibelife/icons/alert/default/alert.svg?url";
import clipExternalUrl from "@vibelife/icons/clip-external/default/clip-external.svg?url";
import clipInsertUrl from "@vibelife/icons/clip-insert/default/clip-insert.svg?url";

import trashUrl from "../assets/history-icons/trash.svg?url";
import archiveUrl from "../assets/history-icons/archive.svg?url";
import infoUrl from "../assets/history-icons/info.svg?url";
import statusTempUrl from "../assets/history-icons/status-temp.svg?url";
import statusArchivedUrl from "../assets/history-icons/status-archived.svg?url";
import sourceManualUrl from "../assets/history-icons/source-manual.svg?url";
import sourceHttpUrl from "../assets/history-icons/source-http.svg?url";
import sourceCursorUrl from "../assets/history-icons/source-cursor.svg?url";
import sourceCursorSkillUrl from "../assets/history-icons/source-cursor-skill.svg?url";
import sourceQuickHotkeyUrl from "../assets/history-icons/source-quick-hotkey.svg?url";
import sourceAllUrl from "../assets/history-icons/source-all.svg?url";
import viewFullUrl from "../assets/history-icons/view-full.svg?url";
import viewCompactUrl from "../assets/history-icons/view-compact.svg?url";
import copyUrl from "../assets/history-icons/copy.svg?url";
import providerGoogleUrl from "../assets/provider-icons/provider-google.svg?url";
import providerVoiceboxUrl from "../assets/provider-icons/provider-voicebox.svg?url";
import providerMinimaxUrl from "../assets/provider-icons/provider-minimax.svg?url";
import providerAddUrl from "../assets/provider-icons/provider-add.svg?url";
import providerProfilesUrl from "../assets/provider-icons/provider-profiles.svg?url";
import tabTtsUrl from "../assets/tab-icons/tab-tts.svg?url";
import tabRoleplayUrl from "../assets/tab-icons/tab-roleplay.svg?url";
import tabHistoryUrl from "../assets/tab-icons/tab-history.svg?url";
import tabMinimaxUrl from "../assets/tab-icons/tab-minimax.svg?url";
import tabExtensionsUrl from "../assets/tab-icons/tab-extensions.svg?url";
import tabChatUrl from "../assets/tab-icons/tab-chat.svg?url";
import tabSettingsUrl from "../assets/tab-icons/tab-settings.svg?url";

/** Slugi z Icons/icons — zawsze wariant `default`, plus history-specific assets. */
export type IconSlug =
  | "play"
  | "pause"
  | "spinner"
  | "save"
  | "x-circle"
  | "folder"
  | "folder-filled"
  | "chevron-down"
  | "reload"
  | "undo"
  | "redo"
  | "minimize"
  | "close"
  | "alert"
  | "clip-external"
  | "clip-insert"
  | "trash"
  | "archive"
  | "info"
  | "status-temp"
  | "status-archived"
  | "source-manual"
  | "source-http"
  | "source-cursor"
  | "source-cursor-skill"
  | "source-quick-hotkey"
  | "source-all"
  | "view-full"
  | "view-compact"
  | "copy"
  | "provider-google"
  | "provider-voicebox"
  | "provider-minimax"
  | "provider-add"
  | "provider-profiles"
  | "tab-tts"
  | "tab-roleplay"
  | "tab-history"
  | "tab-minimax"
  | "tab-extensions"
  | "tab-chat"
  | "tab-settings";

export const ICON_SRC: Record<IconSlug, string> = {
  play: playUrl,
  pause: pauseUrl,
  spinner: spinnerUrl,
  save: saveUrl,
  "x-circle": xCircleUrl,
  folder: folderUrl,
  "folder-filled": folderFilledUrl,
  "chevron-down": chevronDownUrl,
  reload: refreshUrl,
  undo: undoUrl,
  redo: redoUrl,
  minimize: minimizeUrl,
  close: closeUrl,
  alert: alertUrl,
  "clip-external": clipExternalUrl,
  "clip-insert": clipInsertUrl,
  trash: trashUrl,
  archive: archiveUrl,
  info: infoUrl,
  "status-temp": statusTempUrl,
  "status-archived": statusArchivedUrl,
  "source-manual": sourceManualUrl,
  "source-http": sourceHttpUrl,
  "source-cursor": sourceCursorUrl,
  "source-cursor-skill": sourceCursorSkillUrl,
  "source-quick-hotkey": sourceQuickHotkeyUrl,
  "source-all": sourceAllUrl,
  "view-full": viewFullUrl,
  "view-compact": viewCompactUrl,
  copy: copyUrl,
  "provider-google": providerGoogleUrl,
  "provider-voicebox": providerVoiceboxUrl,
  "provider-minimax": providerMinimaxUrl,
  "provider-add": providerAddUrl,
  "provider-profiles": providerProfilesUrl,
  "tab-tts": tabTtsUrl,
  "tab-roleplay": tabRoleplayUrl,
  "tab-history": tabHistoryUrl,
  "tab-minimax": tabMinimaxUrl,
  "tab-extensions": tabExtensionsUrl,
  "tab-chat": tabChatUrl,
  "tab-settings": tabSettingsUrl,
};
