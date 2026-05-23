import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import { JobsProvider } from "./context/JobsContext";
import QuickHotkeyToast from "./components/QuickHotkeyToast";
import PlaybackToast from "./components/PlaybackToast";
import QuickSetupApp from "./components/quickSetup/QuickSetupApp";
import "./styles.css";
import { bootstrapSkinFromStorage } from "./skins/applySkin";
import { isTauriApp } from "./lib/tauriEnv";

async function boot() {
  bootstrapSkinFromStorage();

  const label = isTauriApp() ? getCurrentWebviewWindow().label : "";
  const isToastWindow = label === "quick-hotkey-toast";
  const isPlaybackToastWindow = label === "playback-toast";
  const isQuickSetupWindow = label === "quick-setup";

  if (isQuickSetupWindow) {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QuickSetupApp />
      </React.StrictMode>,
    );
    return;
  }

  if (isToastWindow) {
    document.documentElement.classList.add("toast-window");
    document.body.classList.add("toast-window");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <JobsProvider>
          <QuickHotkeyToast standalone />
        </JobsProvider>
      </React.StrictMode>,
    );
    return;
  }

  if (isPlaybackToastWindow) {
    document.documentElement.classList.add("toast-window");
    document.body.classList.add("toast-window");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <PlaybackToast standalone />
      </React.StrictMode>,
    );
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
