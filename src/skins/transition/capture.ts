import { toCanvas } from "html-to-image";

function fitSnapshotToViewport(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  if (source.width === width && source.height === height) return source;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return out;
}

/** Solid fallback when DOM capture fails (Tauri/WebView2) — flip is still visible. */
export function createFallbackSnapshot(
  root: HTMLElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const bg =
    getComputedStyle(root).backgroundColor ||
    getComputedStyle(document.documentElement).getPropertyValue("--color-bg") ||
    "rgb(15, 17, 21)";
  ctx.fillStyle = bg.includes("rgb") ? bg : `rgb(${bg.trim() || "15 17 21"})`;
  ctx.fillRect(0, 0, width, height);

  const step = 48;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText("TTS Hub", 24, 36);

  return canvas;
}

export async function captureViewportSnapshot(
  root: HTMLElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  const rect = root.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const captureScale = Math.min(1, Math.max(0.5, scale));

  try {
    const raw = await toCanvas(root, {
      width: Math.floor(width * captureScale),
      height: Math.floor(height * captureScale),
      pixelRatio: 1,
      cacheBust: true,
      skipAutoScale: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.dataset.skinTransitionOverlay === "true") return false;
        return true;
      },
    });
    return fitSnapshotToViewport(raw, width, height);
  } catch {
    return createFallbackSnapshot(root, width, height);
  }
}
