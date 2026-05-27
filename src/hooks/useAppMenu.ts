import { listen } from "@tauri-apps/api/event";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { useEffect } from "react";
import {
  archiveGeneration,
  exportGenerationToPath,
  openArchiveFolder,
  readTextFile,
} from "../api/tauri";
import { loadSaveFormat } from "../audioFormats";
import { isTauriApp } from "../lib/tauriEnv";
import { displayTitle } from "../lib/generationTitle";
import type { Generation } from "../types";

export type MenuActionId =
  | "open_text"
  | "open_archive"
  | "save"
  | "save_as"
  | "settings"
  | "quick_setup"
  | "quick_hotkeys"
  | "soundboard"
  | "about";

interface Options {
  current: Generation | null;
  setEditorText: (text: string) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
  onOpenSettings: () => void;
  onOpenQuickSetup?: () => void;
  onOpenQuickHotkeys?: () => void;
  onOpenSoundboard?: () => void;
}

export function useAppMenu({
  current,
  setEditorText,
  onRefresh,
  onError,
  onOpenSettings,
  onOpenQuickSetup,
  onOpenQuickHotkeys,
  onOpenSoundboard,
}: Options) {
  useEffect(() => {
    if (!isTauriApp()) return;
    const unlisten = listen<string>("menu-action", (event) => {
      const id = event.payload;
      void (async () => {
        try {
          switch (id as MenuActionId | "restart") {
            case "open_text":
              await handleOpenText(setEditorText);
              break;
            case "open_archive":
              await openArchiveFolder();
              break;
            case "save":
              await handleSave(current, onRefresh);
              break;
            case "save_as":
              await handleSaveAs(current, onError);
              break;
            case "settings":
              onOpenSettings();
              break;
            case "quick_setup":
              onOpenQuickSetup?.();
              break;
            case "quick_hotkeys":
              onOpenQuickHotkeys?.();
              break;
            case "soundboard":
              onOpenSoundboard?.();
              break;
            case "about":
              await message(
                "TTS Hub — synteza mowy przez Google Gemini i Voice Box.\nLokalne API: http://127.0.0.1:8765",
                { title: "O TTS Hub", kind: "info" },
              );
              break;
            default:
              break;
          }
        } catch (e) {
          onError(String(e));
        }
      })();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [
    current,
    setEditorText,
    onRefresh,
    onError,
    onOpenSettings,
    onOpenQuickSetup,
    onOpenQuickHotkeys,
    onOpenSoundboard,
  ]);
}

async function handleOpenText(setEditorText: (text: string) => void) {
  const picked = await open({
    multiple: false,
    filters: [{ name: "Tekst", extensions: ["txt", "md", "markdown"] }],
  });
  if (!picked || typeof picked !== "string") return;
  const text = await readTextFile(picked);
  setEditorText(text);
}

async function handleSave(current: Generation | null, onRefresh: () => void) {
  if (!current) {
    await message("Wybierz generację z historii lub wygeneruj nową.", {
      title: "Zapisz",
      kind: "warning",
    });
    return;
  }
  if (current.status !== "done") {
    await message("Generacja nie jest jeszcze ukończona.", { title: "Zapisz", kind: "warning" });
    return;
  }
  if (current.is_archived) {
    await message("Ta generacja jest już zapisana w archiwum.", { title: "Zapisz", kind: "info" });
    return;
  }
  await archiveGeneration(current.id, loadSaveFormat());
  onRefresh();
}

async function handleSaveAs(current: Generation | null, onError: (msg: string) => void) {
  if (!current) {
    await message("Wybierz generację z historii lub wygeneruj nową.", {
      title: "Zapisz jako",
      kind: "warning",
    });
    return;
  }
  if (current.status !== "done" || !current.file_path) {
    await message("Brak pliku audio do zapisania.", { title: "Zapisz jako", kind: "warning" });
    return;
  }
  const title = displayTitle(current);
  const ext = current.format || "wav";
  const dest = await save({
    defaultPath: `${title}.${ext}`,
    filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg"] }],
  });
  if (!dest) return;
  try {
    await exportGenerationToPath(current.id, dest);
  } catch (e) {
    onError(String(e));
  }
}
