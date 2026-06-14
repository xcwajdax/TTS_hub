import type { BlockDoc } from "../../components/editor/types";
import { EMPTY_DOC } from "../../components/editor/types";

export const EDITOR_TABS_VERSION = 1 as const;

export interface EditorTab {
  id: string;
  title: string;
  titleManual?: boolean;
  blockDoc: BlockDoc;
  voiceProfileId: string | null;
  filterPresetId: string;
  generationId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EditorTabsState {
  version: typeof EDITOR_TABS_VERSION;
  tabs: EditorTab[];
  activeTabId: string;
}

export type EditorTabPatch = Partial<
  Pick<
    EditorTab,
    | "title"
    | "titleManual"
    | "blockDoc"
    | "voiceProfileId"
    | "filterPresetId"
    | "generationId"
  >
>;

export function cloneBlockDoc(doc: BlockDoc): BlockDoc {
  return {
    blocks: doc.blocks.map((b) => ({
      ...b,
      meta: b.meta ? { ...b.meta } : undefined,
    })),
  };
}

export function createEmptyTab(
  id: string,
  title: string,
  filterPresetId: string,
  voiceProfileId: string | null = null,
): EditorTab {
  const now = Date.now();
  return {
    id,
    title,
    blockDoc: cloneBlockDoc(EMPTY_DOC),
    voiceProfileId,
    filterPresetId,
    generationId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeTab(tab: EditorTab): EditorTab {
  return {
    ...tab,
    blockDoc: cloneBlockDoc(tab.blockDoc),
  };
}

export function serializeTabsState(state: EditorTabsState): EditorTabsState {
  return {
    version: EDITOR_TABS_VERSION,
    tabs: state.tabs.map(serializeTab),
    activeTabId: state.activeTabId,
  };
}
