import { nanoid } from "nanoid";
import { EMPTY_DOC } from "../../components/editor/types";
import {
  createEmptyTab,
  EDITOR_TABS_VERSION,
  type EditorTab,
  type EditorTabsState,
} from "./types";

const STORAGE_KEY = "tts-hub.editor-tabs.v1";

function isBlockDoc(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const blocks = (raw as { blocks?: unknown }).blocks;
  return Array.isArray(blocks);
}

function parseTab(raw: unknown, fallbackFilterPresetId: string): EditorTab | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : nanoid(10);
  const title = typeof o.title === "string" ? o.title : "Szkic";
  const filterPresetId =
    typeof o.filterPresetId === "string" ? o.filterPresetId : fallbackFilterPresetId;
  const voiceProfileId =
    o.voiceProfileId === null || typeof o.voiceProfileId === "string"
      ? o.voiceProfileId
      : null;
  const generationId =
    o.generationId === null || typeof o.generationId === "string" ? o.generationId : null;
  const blockDoc = isBlockDoc(o.blockDoc) ? (o.blockDoc as EditorTab["blockDoc"]) : EMPTY_DOC;
  const createdAt = typeof o.createdAt === "number" ? o.createdAt : Date.now();
  const updatedAt = typeof o.updatedAt === "number" ? o.updatedAt : createdAt;
  const titleManual = o.titleManual === true;

  return {
    id,
    title,
    titleManual,
    blockDoc,
    voiceProfileId,
    filterPresetId,
    generationId,
    createdAt,
    updatedAt,
  };
}

export function defaultEditorTabsState(defaultFilterPresetId: string): EditorTabsState {
  const id = nanoid(10);
  return {
    version: EDITOR_TABS_VERSION,
    activeTabId: id,
    tabs: [createEmptyTab(id, "Szkic 1", defaultFilterPresetId)],
  };
}

export function loadEditorTabs(defaultFilterPresetId: string): EditorTabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultEditorTabsState(defaultFilterPresetId);
    const parsed = JSON.parse(raw) as EditorTabsState;
    if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return defaultEditorTabsState(defaultFilterPresetId);
    }
    const tabs = parsed.tabs
      .map((t) => parseTab(t, defaultFilterPresetId))
      .filter((t): t is EditorTab => t !== null);
    if (tabs.length === 0) return defaultEditorTabsState(defaultFilterPresetId);
    const activeTabId = tabs.some((t) => t.id === parsed.activeTabId)
      ? parsed.activeTabId
      : tabs[0]!.id;
    return { version: EDITOR_TABS_VERSION, tabs, activeTabId };
  } catch {
    return defaultEditorTabsState(defaultFilterPresetId);
  }
}

export function saveEditorTabs(state: EditorTabsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota — ignore
  }
}
