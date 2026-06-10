/**
 * Capture promo-related screenshots (browser preview) + regenerate skin previews.
 *
 * Usage:
 *   npm run dev   # in another terminal
 *   node docs/promo/capture/capture-promo-assets.mjs
 *
 * Env:
 *   TTS_HUB_PREVIEW_URL — default http://127.0.0.1:1420
 */
import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMO_ROOT = path.join(__dirname, "..");
const SCREENSHOTS_DIR = path.join(PROMO_ROOT, "..", "screenshots");
const STORYBOARD_SOCIAL = path.join(PROMO_ROOT, "storyboard", "social");
const STORYBOARD_FULL = path.join(PROMO_ROOT, "storyboard", "full");
const BASE_URL = process.env.TTS_HUB_PREVIEW_URL ?? "http://127.0.0.1:1420";
const VIEWPORT_DESKTOP = { width: 1920, height: 1080 };
const VIEWPORT_PORTRAIT = { width: 1080, height: 1920 };

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

async function captureSkins(page) {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  for (const skin of SKINS) {
    console.log(`Skin: ${skin.label}`);
    await applySkin(page, skin.id);
    const outPath = path.join(SCREENSHOTS_DIR, skin.file);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  -> ${outPath}`);
  }
  await copyFile(
    path.join(SCREENSHOTS_DIR, "skin-vibelife.png"),
    path.join(SCREENSHOTS_DIR, "main-window.png"),
  );
}

async function captureStoryboard(page) {
  await mkdir(STORYBOARD_SOCIAL, { recursive: true });
  await mkdir(STORYBOARD_FULL, { recursive: true });

  await applySkin(page, "vibelife");

  const desktopMain = path.join(STORYBOARD_FULL, "app-main.png");
  await page.setViewportSize(VIEWPORT_DESKTOP);
  await page.screenshot({ path: desktopMain });
  console.log(`  -> ${desktopMain}`);

  const socialMain = path.join(STORYBOARD_SOCIAL, "01-tworca.png");
  await page.setViewportSize(VIEWPORT_PORTRAIT);
  await page.screenshot({ path: socialMain });
  console.log(`  -> ${socialMain}`);

  const mapping = [
    ["00-hook.png", STORYBOARD_SOCIAL],
    ["02-developer.png", STORYBOARD_SOCIAL],
    ["03-cursor.png", STORYBOARD_SOCIAL],
    ["04-cta.png", STORYBOARD_SOCIAL],
    ["00-intro.png", STORYBOARD_FULL],
    ["02-developer.png", STORYBOARD_FULL],
    ["03-cursor.png", STORYBOARD_FULL],
    ["04-cta.png", STORYBOARD_FULL],
  ];
  for (const [file, dir] of mapping) {
    const dest = path.join(dir, file);
    await copyFile(desktopMain, dest);
    console.log(`  -> ${dest} (copy)`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT_DESKTOP, deviceScaleFactor: 1 });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 });
  } catch (e) {
    console.error(`Cannot open ${BASE_URL}. Start: npm run dev\n`, e.message ?? e);
    process.exit(1);
  }

  console.log("=== Skins ===");
  await captureSkins(page);
  console.log("=== Storyboard (preview placeholders) ===");
  await captureStoryboard(page);

  await browser.close();
  console.log("\nDone. Replace storyboard PNGs with OBS captures (see capture/CHECKLIST.md).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
