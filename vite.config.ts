import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(rootDir, "../Icons/icons");

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@vibelife/icons": iconsDir,
    },
  },
  clearScreen: false,
  server: {
    fs: {
      allow: [path.resolve(rootDir, "..")],
    },
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
