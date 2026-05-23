import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef } from "react";
import { usePlayback } from "../context/PlaybackContext";
import { isTauriApp } from "../lib/tauriEnv";
import {
  isPlaybackToastDismissed,
  resetDismissIfNewGeneration,
} from "../lib/playbackToastState";
/** Show/hide playback popup while audio plays (or loads) and main is in background. */
export function usePlaybackToastWindow() {
  const { audioRef, current, playing } = usePlayback();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    resetDismissIfNewGeneration(current?.id);
  }, [current?.id]);

  useEffect(() => {
    if (!isTauriApp()) return;

    const sync = async () => {
      const audio = audioRef.current;

      const active = !!current && !!audio && !audio.ended;

      if (!active) {
        if (wasActiveRef.current) {
          await emit("playback-toast:hide");
          await invoke("hide_playback_toast");
        }
        wasActiveRef.current = false;
        return;
      }

      if (current && isPlaybackToastDismissed(current.id)) {
        await emit("playback-toast:hide");
        await invoke("hide_playback_toast");
        wasActiveRef.current = true;
        return;
      }

      try {
        const main = await WebviewWindow.getByLabel("main");
        if (!main) return;
        const focused = await main.isFocused();
        const visible = await main.isVisible();

        const minimized = await main.isMinimized();

        // Ukryj tylko gdy main jest aktywnie na wierzchu (fokus + widoczny, nie zminimalizowany).
        if (focused && visible && !minimized) {
          await emit("playback-toast:hide");
          await invoke("hide_playback_toast");
          wasActiveRef.current = true;
          return;
        }

        await invoke("hide_quick_hotkey_toast");
        await invoke("show_playback_toast", { generation: current });
        wasActiveRef.current = true;
      } catch (e) {
        console.warn("[playback-toast] show/hide failed:", e);
      }
    };

    void sync();

    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => void sync();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [audioRef, current, playing]);
}
