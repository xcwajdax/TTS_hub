import { describe, expect, it } from "vitest";
import { EMPTY_DOC } from "../../components/editor/types";
import type { EditorTab } from "../editorTabs/types";
import type { Generation } from "../../types";
import type { VideoExportRecord } from "../../types/videoTemplate";
import { generationMatchesQuery, runGlobalSearch } from "./match";

function gen(partial: Partial<Generation> & Pick<Generation, "id">): Generation {
  const { id, ...rest } = partial;
  return {
    created_at: 1000,
    text: "",
    title: null,
    model: "model",
    voice: "voice",
    style: null,
    format: "wav",
    duration_ms: 1000,
    file_path: "",
    is_archived: false,
    session_id: "s1",
    source: "manual",
    conversation_id: null,
    summary_text: null,
    status: "done",
    error: null,
    attempts: 1,
    updated_at: 1000,
    ...rest,
    id,
  };
}

function draft(partial: Partial<EditorTab> & Pick<EditorTab, "id">): EditorTab {
  const { id, ...rest } = partial;
  return {
    title: "Szkic",
    blockDoc: EMPTY_DOC,
    voiceProfileId: null,
    filterPresetId: "factory-default",
    generationId: null,
    createdAt: 500,
    updatedAt: 500,
    ...rest,
    id,
  };
}

const videoExport: VideoExportRecord = {
  id: "v1",
  generationId: "g1",
  templateId: "t1",
  filePath: "C:/exports/promo.mp4",
  thumbPath: null,
  durationMs: 5000,
  fileSizeBytes: 1000,
  renderParamsHash: "h",
  createdAt: 2000,
  source: "manual",
  title: "Promo WhatsApp",
};

describe("runGlobalSearch", () => {
  const baseInput = {
    query: "",
    scope: "all" as const,
    session: [gen({ id: "g1", title: "Intro", text: "Witaj w aplikacji" })],
    archive: [gen({ id: "g2", title: "Archiwum nagranie", text: "stary tekst", is_archived: true })],
    cursorFeed: [],
    botsFeed: [],
    drafts: [
      draft({
        id: "d1",
        title: "Szkic marketing",
        blockDoc: {
          blocks: [
            {
              id: "b1",
              kind: "paragraph",
              text: "Oferta specjalna",
              included: true,
            },
          ],
        },
        updatedAt: 3000,
      }),
    ],
    videoExports: [videoExport],
  };

  it("matches history by title tokens (AND)", () => {
    const results = runGlobalSearch({
      ...baseInput,
      query: "intro",
      scope: "history",
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("history");
    if (results[0].kind === "history") expect(results[0].generation.id).toBe("g1");
  });

  it("requires all tokens to match", () => {
    const results = runGlobalSearch({
      ...baseInput,
      query: "intro brak",
      scope: "history",
    });
    expect(results).toHaveLength(0);
  });

  it("matches drafts by body text", () => {
    const results = runGlobalSearch({
      ...baseInput,
      query: "oferta",
      scope: "drafts",
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("draft");
  });

  it("matches files by basename and deduplicates paths", () => {
    const results = runGlobalSearch({
      ...baseInput,
      session: [
        gen({
          id: "g1",
          file_path: "C:/audio/clip.wav",
          title: "Clip",
        }),
        gen({
          id: "g1-dup",
          file_path: "C:/audio/clip.wav",
          title: "Duplicate path",
        }),
      ],
      query: "clip.wav",
      scope: "files",
    });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("file");
  });

  it("matches mp4 exports", () => {
    const results = runGlobalSearch({
      ...baseInput,
      query: "promo",
      scope: "files",
    });
    expect(results.some((r) => r.kind === "file" && r.fileKind === "video")).toBe(true);
  });

  it("returns recent items when query is empty", () => {
    const results = runGlobalSearch({ ...baseInput, scope: "all" });
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("generationMatchesQuery", () => {
  it("matches generation text with AND tokens", () => {
    const g = gen({ id: "g1", title: "Hello world", text: "Lorem ipsum" });
    expect(generationMatchesQuery(g, "hello")).toBe(true);
    expect(generationMatchesQuery(g, "hello missing")).toBe(false);
    expect(generationMatchesQuery(g, "")).toBe(true);
  });
});
