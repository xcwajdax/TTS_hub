import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import TitleBarPrivacyToggle from "./TitleBarPrivacyToggle";
import TitleBarSafeModeToggle from "./TitleBarSafeModeToggle";
import { isTauriApp } from "../lib/tauriEnv";
import type { PrivacyMode } from "../lib/privacyMode";
import { openGlobalSearch } from "../lib/globalSearch/events";
import { appExit, appRestart } from "../api/tauri";

type MenuId =
  | "open_text"
  | "open_archive"
  | "save"
  | "save_as"
  | "search"
  | "settings"
  | "minimax_voices"
  | "quick_setup"
  | "quick_hotkeys"
  | "soundboard"
  | "about"
  | "restart"
  | "quit";

interface MenuEntry {
  id?: MenuId;
  label: string;
  separator?: boolean;
  disabled?: boolean;
}

const MENUS: { label: string; items: MenuEntry[] }[] = [
  {
    label: "Plik",
    items: [
      { id: "open_text", label: "Otwórz tekst…" },
      { id: "open_archive", label: "Otwórz folder archiwum" },
      { separator: true, label: "" },
      { id: "save", label: "Zapisz" },
      { id: "save_as", label: "Zapisz jako…" },
      { separator: true, label: "" },
      { id: "restart", label: "Uruchom ponownie" },
      { id: "quit", label: "Wyjście" },
    ],
  },
  {
    label: "Edycja",
    items: [
      { id: "search", label: "Szukaj… (Ctrl+K)" },
      { separator: true, label: "" },
      { id: "settings", label: "Ustawienia…" },
      { id: "minimax_voices", label: "Głosy Minimax…" },
      { id: "quick_setup", label: "Szybka konfiguracja…" },
      { id: "quick_hotkeys", label: "Szybkie skróty…" },
      { id: "soundboard", label: "Soundboard…" },
    ],
  },
  {
    label: "Pomoc",
    items: [{ id: "about", label: "O TTS Hub" }],
  },
];

async function runMenuAction(id: MenuId) {
  if (id === "search") {
    openGlobalSearch();
    return;
  }
  if (id === "restart") {
    await appRestart();
    return;
  }
  if (id === "quit") {
    await appExit();
    return;
  }
  await emit("menu-action", id);
}

function MaximizeIcon({ restored }: { restored: boolean }) {
  if (restored) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="title-bar__win-icon">
        <path
          d="M4 1h7v7M1 4v7h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="title-bar__win-icon">
      <rect
        x="1.5"
        y="1.5"
        width="9"
        height="9"
        rx="0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("normal");
  const barRef = useRef<HTMLElement>(null);

  const syncMaximized = useCallback(async () => {
    if (!isTauriApp()) return;
    try {
      const win = getCurrentWebviewWindow();
      setMaximized(await win.isMaximized());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;
    void syncMaximized();
    const win = getCurrentWebviewWindow();
    const unlisten = win.onResized(() => {
      void syncMaximized();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [syncMaximized]);

  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenu]);

  if (!isTauriApp()) return null;

  const onMinimize = () => void getCurrentWebviewWindow().minimize();
  const onToggleMaximize = () => void getCurrentWebviewWindow().toggleMaximize();
  const onClose = () => void getCurrentWebviewWindow().close();

  const onDragDoubleClick = (e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return;
    onToggleMaximize();
  };

  return (
    <header
      ref={barRef}
      className="title-bar shrink-0"
      data-privacy-mode={privacyMode}
    >
      <nav className="title-bar__menus" aria-label="Menu aplikacji">
        {MENUS.map((menu) => (
          <div key={menu.label} className="title-bar__menu-wrap">
            <button
              type="button"
              className={`title-bar__menu-btn ${openMenu === menu.label ? "title-bar__menu-btn--open" : ""}`}
              onClick={() => setOpenMenu((m) => (m === menu.label ? null : menu.label))}
              aria-expanded={openMenu === menu.label}
              aria-haspopup="menu"
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <ul className="title-bar__dropdown" role="menu">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <li key={`sep-${i}`} className="title-bar__dropdown-sep" role="separator" />
                  ) : (
                    <li key={item.id} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="title-bar__dropdown-item"
                        onClick={() => {
                          setOpenMenu(null);
                          if (item.id) void runMenuAction(item.id);
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <div
        className="title-bar__brand"
        data-tauri-drag-region
        onDoubleClick={onDragDoubleClick}
        title="Przeciągnij, podwójne kliknięcie — maksymalizuj"
      >
        <img src="/favicon.svg" alt="" className="title-bar__logo" width={16} height={16} draggable={false} />
        <span className="title-bar__title">
          TTS Hub
          {privacyMode === "private" && (
            <span className="title-bar__privacy-label"> — Prywatny</span>
          )}
          {privacyMode === "incognito" && (
            <span className="title-bar__privacy-label"> — Incognito</span>
          )}
        </span>
      </div>

      <div
        className="title-bar__center"
        data-tauri-drag-region
        onDoubleClick={onDragDoubleClick}
      >
        <button
          type="button"
          className="title-bar__search chrome-field chrome-field--wide"
          onClick={() => openGlobalSearch()}
          onMouseDown={(e) => e.stopPropagation()}
          title="Szukaj (Ctrl+K)"
          aria-label="Szukaj w historii, szkicach i plikach"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="title-bar__search-icon">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="title-bar__search-label">Szukaj w historii, szkicach i plikach…</span>
          <kbd className="title-bar__search-kbd">Ctrl+K</kbd>
        </button>
      </div>

      <div className="title-bar__trailing">
      <TitleBarSafeModeToggle />
      <TitleBarPrivacyToggle onModeChange={setPrivacyMode} />

      <div className="title-bar__controls">
        <button
          type="button"
          className="title-bar__control"
          onClick={onMinimize}
          aria-label="Minimalizuj"
          title="Minimalizuj"
        >
          <Icon name="minimize" size={14} className="title-bar__control-icon" />
        </button>
        <button
          type="button"
          className="title-bar__control"
          onClick={onToggleMaximize}
          aria-label={maximized ? "Przywróć" : "Maksymalizuj"}
          title={maximized ? "Przywróć" : "Maksymalizuj"}
        >
          <MaximizeIcon restored={maximized} />
        </button>
        <button
          type="button"
          className="title-bar__control title-bar__control--close"
          onClick={onClose}
          aria-label="Zamknij"
          title="Zamknij"
        >
          <Icon name="close" size={14} className="title-bar__control-icon" />
        </button>
      </div>
      </div>
    </header>
  );
}
