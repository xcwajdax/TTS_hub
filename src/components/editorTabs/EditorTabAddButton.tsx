import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAppSettings } from "../../api/tauri";
import type { TtsVoiceProfile } from "../../appSettings";
import { useVoiceAvatar } from "../../hooks/useAvatars";
import { profileVoiceId, sortProfilesForChatList } from "../../lib/voiceProfiles";
import { VOICE_PROFILES_CHANGED } from "../../lib/voiceProfilesEvents";
import type { TtsProvider } from "../../types";
import ProviderAvatar from "../ProviderAvatar";

const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE_PX = 10;

interface Props {
  onAddTab: (voiceProfileId?: string | null) => void;
}

interface PickerItemProps {
  profile: TtsVoiceProfile;
  hovered: boolean;
}

function ProfilePickerItem({ profile, hovered }: PickerItemProps) {
  const voiceId = profileVoiceId(profile);
  const avatar = useVoiceAvatar(profile.provider as TtsProvider, voiceId);

  return (
    <div
      role="option"
      aria-selected={hovered}
      data-voice-profile-id={profile.id}
      className={`editor-tab-add-picker__item flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors ${
        hovered ? "bg-accent/15 text-heading" : "text-muted hover:text-heading"
      }`}
      title={profile.name}
    >
      <ProviderAvatar
        provider={profile.provider as TtsProvider}
        filePath={avatar?.path ?? null}
        fallbackLabel={profile.name}
        size={28}
        className="shrink-0 pointer-events-none"
      />
      <span className="text-xs truncate min-w-0 pointer-events-none">{profile.name}</span>
    </div>
  );
}

export default function EditorTabAddButton({ onAddTab }: Props) {
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [hoveredProfileId, setHoveredProfileId] = useState<string | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const menuOpenedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const sortedProfiles = useMemo(() => sortProfilesForChatList(profiles), [profiles]);

  useEffect(() => {
    const refresh = () => {
      void getAppSettings()
        .then((view) => setProfiles(view.voice_profiles ?? []))
        .catch(() => setProfiles([]));
    };
    refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, refresh);
    return () => window.removeEventListener(VOICE_PROFILES_CHANGED, refresh);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setHoveredProfileId(null);
    menuOpenedRef.current = false;
  }, []);

  const profileIdAtPoint = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest("[data-voice-profile-id]")?.getAttribute("data-voice-profile-id") ?? null;
  }, []);

  const openMenu = useCallback((rect: DOMRect) => {
    menuOpenedRef.current = true;
    setAnchorRect(rect);
    setMenuOpen(true);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    suppressClickRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      if (sortedProfiles.length === 0) return;
      openMenu(rect);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    if (start && !menuOpenedRef.current) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
        clearLongPressTimer();
      }
    }

    if (menuOpenedRef.current) {
      setHoveredProfileId(profileIdAtPoint(e.clientX, e.clientY));
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    clearLongPressTimer();

    if (menuOpenedRef.current) {
      const profileId = profileIdAtPoint(e.clientX, e.clientY);
      if (profileId) {
        onAddTab(profileId);
      }
      closeMenu();
      suppressClickRef.current = true;
    } else if (pointerStartRef.current) {
      onAddTab();
    }

    pointerStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    finishPointer(e);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    clearLongPressTimer();
    closeMenu();
    pointerStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  return (
    <>
      <button
        type="button"
        className="editor-tab-bar__add shrink-0 px-2.5 text-muted hover:text-heading hover:bg-panel2 border-r border-border/60 touch-none select-none"
        title="Nowa zakładka (przytrzymaj — wybierz profil głosu)"
        aria-label="Nowa zakładka"
        aria-haspopup={sortedProfiles.length > 0 ? "listbox" : undefined}
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        +
      </button>
      {menuOpen && anchorRect ? (
        <div
          className="editor-tab-add-picker fixed z-[200] min-w-[10rem] max-w-[14rem] py-1 px-1 border border-border bg-panel shadow-lg"
          style={{ left: anchorRect.left, top: anchorRect.bottom + 2 }}
          role="listbox"
          aria-label="Wybierz profil głosu dla nowej zakładki"
          onPointerMove={(e) => setHoveredProfileId(profileIdAtPoint(e.clientX, e.clientY))}
        >
          {sortedProfiles.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted">Brak profili głosu</p>
          ) : (
            sortedProfiles.map((profile) => (
              <ProfilePickerItem
                key={profile.id}
                profile={profile}
                hovered={hoveredProfileId === profile.id}
              />
            ))
          )}
        </div>
      ) : null}
    </>
  );
}
