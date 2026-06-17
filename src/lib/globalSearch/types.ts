import type { EditorTab } from "../editorTabs/types";
import type { Generation } from "../../types";
import type { VideoExportRecord } from "../../types/videoTemplate";

export type SearchScope = "all" | "history" | "drafts" | "files";

export type HistoryScopeLabel = "Sesja" | "Archiwum" | "Cursor" | "Boty";

export interface HistorySearchResult {
  kind: "history";
  id: string;
  generation: Generation;
  scopeLabel: HistoryScopeLabel;
  title: string;
  snippet: string;
  score: number;
  sortKey: number;
}

export interface DraftSearchResult {
  kind: "draft";
  id: string;
  tab: EditorTab;
  title: string;
  snippet: string;
  score: number;
  sortKey: number;
}

export interface FileSearchResult {
  kind: "file";
  id: string;
  fileKind: "audio" | "video";
  path: string;
  title: string;
  snippet: string;
  generationId: string | null;
  videoExportId: string | null;
  score: number;
  sortKey: number;
}

export type GlobalSearchResult = HistorySearchResult | DraftSearchResult | FileSearchResult;

export interface GlobalSearchInput {
  query: string;
  scope: SearchScope;
  session: Generation[];
  archive: Generation[];
  cursorFeed: Generation[];
  botsFeed: Generation[];
  drafts: EditorTab[];
  videoExports: VideoExportRecord[];
}
