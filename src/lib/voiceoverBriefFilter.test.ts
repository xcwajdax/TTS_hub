import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyTextFilters, countWords } from "./textFilters";
import { getVoiceoverBriefPreset } from "./filterPresetCatalog";
import { applyVoiceoverBriefFilters } from "./voiceoverBriefFilter";
import {
  blockDocToFilteredBase,
  resolveFilterSourceText,
} from "../components/textFilters/BlockEditorPane";
import type { BlockDoc } from "../components/editor/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "__fixtures__", "voiceover-brief-sample.md");

const fixturePathV2 = join(__dirname, "__fixtures__", "voiceover-brief-sample-v2.md");

function loadFixture(): string {
  return readFileSync(fixturePath, "utf8");
}

function loadFixtureV2(): string {
  return readFileSync(fixturePathV2, "utf8");
}

describe("factory-voiceover-brief preset", () => {
  const preset = getVoiceoverBriefPreset();

  it("strips production metadata and keeps spoken content", () => {
    const { output } = applyTextFilters(loadFixture(), preset);

    expect(output).not.toMatch(/\*\*Cel:\*\*/);
    expect(output).not.toMatch(/\*\*Styl:\*\*/);
    expect(output).not.toMatch(/\*\*Tempo:\*\*/);
    expect(output).not.toContain("## OTWARCIE");
    expect(output).not.toContain("---");
    expect(output).not.toContain("## TIMING");
    expect(output).not.toContain("MIEJSCA NA PAUZĘ");
    expect(output).not.toContain("CO NAGRYWAĆ PRZED");

    expect(output).toContain("Lyric Visualizer");
    expect(output).toContain("Whisper");
    expect(output).toContain("ALIVE");
    expect(output).toContain("Musixmatch");
    expect(output).toContain("Take brings me so down");
    expect(output).toContain("The ache brings me so down");
    expect(output).toContain("Deadline'ów");

    expect(output.trimStart().startsWith("Krótki brief o narzędziu")).toBe(true);
    expect(output.trimEnd().endsWith("Do usłyszenia.")).toBe(true);
  });

  it("unwraps bold markers", () => {
    const { output } = applyTextFilters("To jest **ALIVE** test.", preset);
    expect(output).toBe("To jest ALIVE test.");
  });

  it("inserts paragraph pauses", () => {
    const { output } = applyTextFilters("Pierwszy akapit.\n\nDrugi akapit.", preset);
    expect(output).toContain(" ... ");
  });

  it("handles NEWSKIN v2 brief with spoken content", () => {
    const { output, warnings } = applyTextFilters(loadFixtureV2(), preset);
    expect(warnings).toEqual([]);
    expect(countWords(output)).toBeGreaterThan(300);
    expect(output).toContain("NEWSKIN");
    expect(output).toContain("Resolume");
    expect(output).toContain("Kuba W.");
    expect(output.trimEnd().endsWith("Do usłyszenia.")).toBe(true);
  });

  it("does not empty when brief is one code block (fallback path)", () => {
    const md = loadFixtureV2();
    const doc: BlockDoc = {
      blocks: [{ id: "c1", kind: "code", text: md, included: false }],
    };
    expect(blockDocToFilteredBase(doc, preset, {}).trim()).toBe("");
    const input = resolveFilterSourceText(doc, preset, {});
    const { output } = applyVoiceoverBriefFilters(input, preset);
    expect(countWords(output)).toBeGreaterThan(300);
  });

  it("handles block-editor flatten without markdown hashes", () => {
    const md = loadFixtureV2();
    const paragraphs = md.split(/\n{2,}/).map((p, i) => ({
      id: `p${i}`,
      kind: "paragraph" as const,
      text: p.replace(/^#{1,6}\s+/gm, "").trim(),
      included: true,
    }));
    const base = blockDocToFilteredBase({ blocks: paragraphs }, preset, {});
    const { output } = applyVoiceoverBriefFilters(base, preset);
    expect(countWords(output)).toBeGreaterThan(200);
  });
});
