import { blockDocToSourceText } from "../../components/textFilters/BlockEditorPane";
import type { EditorTab } from "../editorTabs/types";
import type { Generation } from "../../types";
import type { VideoExportRecord } from "../../types/videoTemplate";
import type {
  DraftSearchResult,
  FileSearchResult,
  GlobalSearchInput,
  GlobalSearchResult,
  HistoryScopeLabel,
  HistorySearchResult,
  SearchScope,
} from "./types";

const LIMIT_PER_SCOPE = 50;
const LIMIT_ALL = 80;
const RECENT_PER_CATEGORY = 10;

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i >= 0 ? normalized.slice(i + 1) : normalized;
}

function normalizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeSearchQuery(query: string): string[] {
  return normalizeQuery(query);
}

export function generationMatchesQuery(generation: Generation, query: string): boolean {
  const tokens = normalizeQuery(query);
  if (tokens.length === 0) return true;
  const title = deriveGenerationTitle(generation);
  const text = (generation.text ?? "").trim();
  return (
    scoreFields(
      {
        title,
        text,
        extra: [
          generation.summary_text ?? "",
          generation.voice,
          generation.model,
          basename(generation.file_path ?? ""),
        ],
        sortKey: generation.updated_at || generation.created_at,
      },
      tokens,
    ) > 0
  );
}

export function filterGenerationsByTextQuery(
  generations: Generation[],
  query: string,
): Generation[] {
  const trimmed = query.trim();
  if (!trimmed) return generations;
  return generations.filter((g) => generationMatchesQuery(g, trimmed));
}

function snippet(text: string, max = 120): string {
  const t = text.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function deriveGenerationTitle(g: Generation): string {
  const title = (g.title ?? "").trim();
  if (title) return title;
  const text = (g.text ?? "").trim();
  if (!text) return "(bez tytułu)";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

interface MatchFields {
  title: string;
  text: string;
  extra: string[];
  sortKey: number;
}

function scoreFields(fields: MatchFields, tokens: string[]): number {
  if (tokens.length === 0) return 1;

  const haystacks = [
    { value: fields.title.toLowerCase(), weight: 12 },
    { value: fields.text.toLowerCase(), weight: 6 },
    ...fields.extra.map((v) => ({ value: v.toLowerCase(), weight: 3 })),
  ];

  let total = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    for (const { value, weight } of haystacks) {
      if (!value) continue;
      if (value === token) tokenScore = Math.max(tokenScore, weight * 3);
      else if (value.startsWith(token)) tokenScore = Math.max(tokenScore, weight * 2);
      else if (value.includes(token)) tokenScore = Math.max(tokenScore, weight);
    }
    if (tokenScore === 0) return 0;
    total += tokenScore;
  }
  return total;
}

function matchHistory(
  generation: Generation,
  scopeLabel: HistoryScopeLabel,
  tokens: string[],
): HistorySearchResult | null {
  const title = deriveGenerationTitle(generation);
  const text = (generation.text ?? "").trim();
  const score = scoreFields(
    {
      title,
      text,
      extra: [
        generation.summary_text ?? "",
        generation.voice,
        generation.model,
        basename(generation.file_path ?? ""),
      ],
      sortKey: generation.updated_at || generation.created_at,
    },
    tokens,
  );
  if (score === 0) return null;

  return {
    kind: "history",
    id: `history:${generation.id}`,
    generation,
    scopeLabel,
    title,
    snippet: snippet(text || title),
    score,
    sortKey: generation.updated_at || generation.created_at,
  };
}

function matchDraft(tab: EditorTab, tokens: string[]): DraftSearchResult | null {
  const body = blockDocToSourceText(tab.blockDoc).trim();
  const title = tab.title.trim() || "Szkic";
  const score = scoreFields(
    {
      title,
      text: body,
      extra: [],
      sortKey: tab.updatedAt,
    },
    tokens,
  );
  if (score === 0) return null;

  return {
    kind: "draft",
    id: `draft:${tab.id}`,
    tab,
    title,
    snippet: snippet(body || title),
    score,
    sortKey: tab.updatedAt,
  };
}

function matchAudioFile(
  generation: Generation,
  tokens: string[],
  seen: Set<string>,
): FileSearchResult | null {
  const path = generation.file_path?.trim();
  if (!path || generation.status !== "done") return null;
  const key = path.toLowerCase();
  if (seen.has(key)) return null;

  const fileName = basename(path);
  const title = deriveGenerationTitle(generation);
  const score = scoreFields(
    {
      title,
      text: fileName,
      extra: [path],
      sortKey: generation.updated_at || generation.created_at,
    },
    tokens,
  );
  if (score === 0) return null;

  seen.add(key);
  return {
    kind: "file",
    id: `file:audio:${generation.id}`,
    fileKind: "audio",
    path,
    title: fileName || title,
    snippet: title,
    generationId: generation.id,
    videoExportId: null,
    score,
    sortKey: generation.updated_at || generation.created_at,
  };
}

function matchVideoFile(
  record: VideoExportRecord,
  tokens: string[],
  seen: Set<string>,
): FileSearchResult | null {
  const path = record.filePath?.trim();
  if (!path) return null;
  const key = path.toLowerCase();
  if (seen.has(key)) return null;

  const fileName = basename(path);
  const title = (record.title ?? "").trim() || fileName;
  const score = scoreFields(
    {
      title,
      text: fileName,
      extra: [path, record.source],
      sortKey: record.createdAt,
    },
    tokens,
  );
  if (score === 0) return null;

  seen.add(key);
  return {
    kind: "file",
    id: `file:video:${record.id}`,
    fileKind: "video",
    path,
    title: fileName || title,
    snippet: title,
    generationId: record.generationId || null,
    videoExportId: record.id,
    score,
    sortKey: record.createdAt,
  };
}

function sortResults<T extends { score: number; sortKey: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score || b.sortKey - a.sortKey);
}

function collectHistory(input: GlobalSearchInput, tokens: string[]): HistorySearchResult[] {
  const pools: { label: HistoryScopeLabel; items: Generation[] }[] = [
    { label: "Sesja", items: input.session },
    { label: "Archiwum", items: input.archive },
    { label: "Cursor", items: input.cursorFeed },
    { label: "Boty", items: input.botsFeed },
  ];

  const results: HistorySearchResult[] = [];
  const seen = new Set<string>();

  for (const pool of pools) {
    for (const g of pool.items) {
      if (seen.has(g.id)) continue;
      const hit = matchHistory(g, pool.label, tokens);
      if (!hit) continue;
      seen.add(g.id);
      results.push(hit);
    }
  }

  return sortResults(results);
}

function collectDrafts(input: GlobalSearchInput, tokens: string[]): DraftSearchResult[] {
  return sortResults(
    input.drafts
      .map((tab) => matchDraft(tab, tokens))
      .filter((r): r is DraftSearchResult => r !== null),
  );
}

function collectFiles(input: GlobalSearchInput, tokens: string[]): FileSearchResult[] {
  const seen = new Set<string>();
  const results: FileSearchResult[] = [];

  const allGenerations = [
    ...input.session,
    ...input.archive,
    ...input.cursorFeed,
    ...input.botsFeed,
  ];

  for (const g of allGenerations) {
    const hit = matchAudioFile(g, tokens, seen);
    if (hit) results.push(hit);
  }

  for (const v of input.videoExports) {
    const hit = matchVideoFile(v, tokens, seen);
    if (hit) results.push(hit);
  }

  return sortResults(results);
}

function recentHistory(input: GlobalSearchInput): HistorySearchResult[] {
  return collectHistory(input, []).slice(0, RECENT_PER_CATEGORY);
}

function recentDrafts(input: GlobalSearchInput): DraftSearchResult[] {
  return sortResults(
    input.drafts
      .map((tab) => matchDraft(tab, []))
      .filter((r): r is DraftSearchResult => r !== null),
  ).slice(0, RECENT_PER_CATEGORY);
}

function recentFiles(input: GlobalSearchInput): FileSearchResult[] {
  return collectFiles(input, []).slice(0, RECENT_PER_CATEGORY);
}

function applyScopeLimit(results: GlobalSearchResult[], scope: SearchScope): GlobalSearchResult[] {
  const limit = scope === "all" ? LIMIT_ALL : LIMIT_PER_SCOPE;
  return results.slice(0, limit);
}

function filterByScope(results: GlobalSearchResult[], scope: SearchScope): GlobalSearchResult[] {
  if (scope === "all") return results;
  if (scope === "history") return results.filter((r) => r.kind === "history");
  if (scope === "drafts") return results.filter((r) => r.kind === "draft");
  return results.filter((r) => r.kind === "file");
}

export function runGlobalSearch(input: GlobalSearchInput): GlobalSearchResult[] {
  const tokens = normalizeQuery(input.query);
  const isEmpty = tokens.length === 0;

  let results: GlobalSearchResult[];

  if (isEmpty) {
    if (input.scope === "history") results = recentHistory(input);
    else if (input.scope === "drafts") results = recentDrafts(input);
    else if (input.scope === "files") results = recentFiles(input);
    else {
      results = sortResults([
        ...recentHistory(input),
        ...recentDrafts(input),
        ...recentFiles(input),
      ]);
    }
  } else if (input.scope === "history") {
    results = collectHistory(input, tokens);
  } else if (input.scope === "drafts") {
    results = collectDrafts(input, tokens);
  } else if (input.scope === "files") {
    results = collectFiles(input, tokens);
  } else {
    results = sortResults([
      ...collectHistory(input, tokens),
      ...collectDrafts(input, tokens),
      ...collectFiles(input, tokens),
    ]);
  }

  return applyScopeLimit(filterByScope(results, input.scope), input.scope);
}

export function scopeLabel(scope: SearchScope): string {
  switch (scope) {
    case "all":
      return "Wszystko";
    case "history":
      return "Historia";
    case "drafts":
      return "Szkice";
    case "files":
      return "Pliki";
  }
}

export const SEARCH_SCOPES: SearchScope[] = ["all", "history", "drafts", "files"];
