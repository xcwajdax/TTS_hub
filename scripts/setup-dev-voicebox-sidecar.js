#!/usr/bin/env node

/**
 * Creates placeholder sidecar binaries so `tauri dev` / `cargo build` succeed
 * before the real PyInstaller binary is built (release only).
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BINARIES_DIR = join(__dirname, "..", "src-tauri", "binaries");
const MIN_REAL_BINARY_SIZE = 10000;

function getTargetTriple() {
  try {
    return execSync("rustc --print host-tuple", { encoding: "utf-8" }).trim();
  } catch {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === "win32") {
      return arch === "x64" ? "x86_64-pc-windows-msvc" : "i686-pc-windows-msvc";
    }
    if (platform === "darwin") {
      return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
    }
    if (platform === "linux") {
      return arch === "x64" ? "x86_64-unknown-linux-gnu" : "aarch64-unknown-linux-gnu";
    }
    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }
}

function createPlaceholderBinary(targetTriple) {
  const isWindows = targetTriple.includes("windows");
  const binaryName = `voicebox-server-${targetTriple}${isWindows ? ".exe" : ""}`;
  const binaryPath = join(BINARIES_DIR, binaryName);

  if (existsSync(binaryPath)) {
    try {
      const stats = statSync(binaryPath);
      if (stats.size > MIN_REAL_BINARY_SIZE) {
        console.log(
          `Real binary already exists: ${binaryName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`,
        );
        return;
      }
    } catch {
      // replace broken file
    }
  }

  if (!existsSync(BINARIES_DIR)) {
    mkdirSync(BINARIES_DIR, { recursive: true });
  }

  if (isWindows) {
    const minimalPE = Buffer.alloc(512, 0);
    minimalPE[0] = 0x4d;
    minimalPE[1] = 0x5a;
    minimalPE[2] = 0x90;
    writeFileSync(binaryPath, minimalPE);
  } else {
    const script = `#!/bin/sh
echo "[voicebox-server] Dev placeholder — use bundled Python or run: just dev-server in voicebox-backend/"
exit 1
`;
    writeFileSync(binaryPath, script, { mode: 0o755 });
  }

  console.log(`Created dev placeholder: ${binaryName}`);
}

createPlaceholderBinary(getTargetTriple());
