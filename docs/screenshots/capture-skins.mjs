/**
 * Capture README screenshots for builtin skins (Vite preview, 1400×900).
 * Requires: npm run dev on :1420, npx playwright (chromium).
 *
 * Usage: node docs/screenshots/capture-skins.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const BASE_URL = process.env.TTS_HUB_PREVIEW_URL ?? "http://127.0.0.1:1420";
const VIEWPORT = { width: 1400, height: 900 };

const SKINS = [
  { id: "vibelife", file: "skin-vibelife.png", label: "VIBELIFE" },
  { id: "matrix", file: "skin-matrix.png", label: "Matrix" },
  { id: "light-zen", file: "skin-light-zen.png", label: "Light / Zen" },
];

async function waitForApp(page) {
  await page.waitForSelector("#root", { timeout: 60_000 });
  await page.waitForTimeout(800);
}

async function applySkin(page, skinId) {
  await page.evaluate((id) => {
    localStorage.setItem("tts-hub-active-skin", id);
    document.documentElement.dataset.skin = id;
  }, skinId);
  await page.reload({ waitUntil: "networkidle" });
  await waitForApp(page);
  await page.evaluate(() => {
    document.querySelectorAll('[role="status"]').forEach((el) => {
      if (el.textContent?.includes("Podgląd UI")) el.remove();
    });
  });
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 });
  } catch (e) {
    console.error(
      `Cannot open ${BASE_URL}. Start preview: npm run dev\n`,
      e.message ?? e,
    );
    process.exit(1);
  }

  for (const skin of SKINS) {
    console.log(`Capturing ${skin.label} (${skin.id})…`);
    await applySkin(page, skin.id);
    const outPath = path.join(OUT_DIR, skin.file);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  -> ${outPath}`);
  }

  const legacy = path.join(OUT_DIR, "main-window.png");
  const primary = path.join(OUT_DIR, "skin-vibelife.png");
  const { copyFile } = await import("node:fs/promises");
  await copyFile(primary, legacy);
  console.log(`  -> ${legacy} (copy of skin-vibelife)`);

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
