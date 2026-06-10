import type { IconSlug } from "./icons";

export const HISTORY_TOOLBAR_BTN =
  "inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-border bg-panel2 text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed";

export const HISTORY_TOOLBAR_BTN_ACTIVE = "history-toolbar-btn-active";

export type HistoryScopeTab = "session" | "archive" | "cursor" | "bots" | "soundboard";

export const SCOPE_TAB_META: Record<
  HistoryScopeTab,
  { icon: IconSlug; label: string; title?: string }
> = {
  session: { icon: "status-temp", label: "Sesja" },
  cursor: {
    icon: "source-cursor",
    label: "Cursor",
    title: "Wszystko z Cursor (sesja + archiwum)",
  },
  bots: {
    icon: "source-http",
    label: "Boty",
    title: "Generacje z zewnętrznych botów (Telegram, Discord…)",
  },
  archive: { icon: "archive", label: "Archiwum" },
  soundboard: {
    icon: "play",
    label: "Soundboard",
    title: "8 slotów audio · Ctrl+Shift+1–8",
  },
};

export type HistoryGroupingMode = "date" | "profile";
