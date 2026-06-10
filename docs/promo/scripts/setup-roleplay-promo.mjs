/**
 * Seed Roleplay project for promo film into history.db.
 * Uses Node 22+ node:sqlite when available; falls back to child_process sqlite3.
 *
 * Usage: node docs/promo/scripts/setup-roleplay-promo.mjs --db %APPDATA%/TTS_hub/history.db --project docs/promo/roleplay/promo-project.json
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  let db = "";
  let project = path.join(__dirname, "../roleplay/promo-project.json");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--db") db = args[++i];
    if (args[i] === "--project") project = args[++i];
  }
  if (!db) {
    const appData = process.env.APPDATA ?? path.join(process.env.HOME ?? "", ".local/share");
    db = path.join(appData, "TTS_hub", "history.db");
  }
  return { db, project };
}

function loadProject(projectPath) {
  const raw = JSON.parse(readFileSync(projectPath, "utf8"));
  return {
    id: raw.project_id,
    name: raw.project_name,
    palette_json: JSON.stringify(raw.palette),
    doc_json: JSON.stringify(raw.doc_json),
    timeline_json: JSON.stringify({ tracks: [], clips: [] }),
  };
}

/** Walk TipTap doc — same logic as src/roleplay/segments.ts */
function docToSegments(docJson, palette) {
  const colorToProfile = new Map(palette.map((p) => [p.color, p.voiceProfileId]));
  const doc = JSON.parse(docJson);

  function walk(nodes, onText) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "text" && node.text) {
        let color = null;
        for (const mark of node.marks ?? []) {
          if (mark.type === "highlight" && mark.attrs?.color) {
            color = mark.attrs.color;
            break;
          }
        }
        onText(node.text, color);
      }
      if (node.content) walk(node.content, onText);
    }
  }

  const raw = [];
  walk(doc.content, (text, color) => {
    if (!color || !text || !colorToProfile.has(color)) return;
    raw.push({ text, color });
  });

  const merged = [];
  for (const piece of raw) {
    const voiceProfileId = colorToProfile.get(piece.color);
    const last = merged[merged.length - 1];
    if (last && last.color === piece.color && last.voice_profile_id === voiceProfileId) {
      last.text += piece.text;
    } else {
      merged.push({ text: piece.text, color: piece.color, voice_profile_id: voiceProfileId });
    }
  }

  return merged
    .map((m, i) => ({
      id: randomUUID(),
      order_index: i,
      text: m.text.trim(),
      voice_profile_id: m.voice_profile_id,
      color: m.color,
      status: "pending",
    }))
    .filter((s) => s.text.length > 0);
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function buildSql(project, segments) {
  const now = Date.now();
  const lines = [
    "BEGIN TRANSACTION;",
    `DELETE FROM roleplay_segments WHERE project_id = '${sqlEscape(project.id)}';`,
    `DELETE FROM roleplay_projects WHERE id = '${sqlEscape(project.id)}';`,
    `INSERT INTO roleplay_projects (id, name, created_at, updated_at, doc_json, palette_json, timeline_json, status)
     VALUES (
       '${sqlEscape(project.id)}',
       '${sqlEscape(project.name)}',
       ${now},
       ${now},
       '${sqlEscape(project.doc_json)}',
       '${sqlEscape(project.palette_json)}',
       '${sqlEscape(project.timeline_json)}',
       'draft'
     );`,
  ];

  for (const seg of segments) {
    lines.push(
      `INSERT INTO roleplay_segments (id, project_id, order_index, text, voice_profile_id, color, generation_id, status, retry_count, error)
       VALUES (
         '${sqlEscape(seg.id)}',
         '${sqlEscape(project.id)}',
         ${seg.order_index},
         '${sqlEscape(seg.text)}',
         '${sqlEscape(seg.voice_profile_id)}',
         '${sqlEscape(seg.color)}',
         NULL,
         'pending',
         0,
         NULL
       );`,
    );
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}

async function runWithNodeSqlite(dbPath, sql) {
  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(dbPath);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}

function runWithSqlite3Cli(dbPath, sql) {
  const r = spawnSync("sqlite3", [dbPath], { input: sql, encoding: "utf8" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(r.stderr || `sqlite3 exit ${r.status}`);
}

async function main() {
  const { db, project: projectPath } = parseArgs();

  if (!existsSync(db)) {
    console.warn(`Baza nie istnieje: ${db}`);
    console.warn("Uruchom TTS Hub raz, zamknij, i powtórz import.");
    process.exit(1);
  }

  const template = loadProject(projectPath);
  const palette = JSON.parse(template.palette_json);
  const segments = docToSegments(template.doc_json, palette);
  const sql = buildSql(template, segments);

  try {
    await runWithNodeSqlite(db, sql);
    console.log(`Projekt Roleplay utworzony: "${template.name}" (${segments.length} segmentów)`);
    console.log(`  ID: ${template.id}`);
    return;
  } catch (e) {
    console.warn("node:sqlite niedostępny, próba sqlite3 CLI…", e.message ?? e);
  }

  try {
    runWithSqlite3Cli(db, sql);
    console.log(`Projekt Roleplay utworzony (sqlite3): "${template.name}" (${segments.length} segmentów)`);
  } catch (e) {
    console.error("Nie udało się zapisać projektu Roleplay:", e.message ?? e);
    console.error("Profile głosów zostały zapisane w settings.json — utwórz projekt ręcznie (patrz docs/promo/roleplay/README.md).");
    process.exit(1);
  }
}

main();
