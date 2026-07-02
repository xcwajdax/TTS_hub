import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(rootDir, "../Icons/icons");

export default defineConfig(({ mode }) => {
  const isFastWork = mode === "fast-work";
  return {
  plugins: [react()],
  resolve: {
    alias: {
      "@vibelife/icons": iconsDir,
    },
  },
  clearScreen: false,
  build: isFastWork
    ? {
        outDir: "dist-fast-work",
        rollupOptions: {
          input: path.resolve(rootDir, "index.fast-work.html"),
        },
      }
    : undefined,
  server: {
    fs: {
      allow: [path.resolve(rootDir, "..")],
    },
    port: isFastWork ? 1421 : 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: isFastWork ? 1422 : 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    headers: {
      "Permissions-Policy": "speaker-selection=(self), microphone=(self), camera=(self)",
    },
  },
};
});
