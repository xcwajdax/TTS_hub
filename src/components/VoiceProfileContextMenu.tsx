import { useEffect, useRef, useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";

interface Props {
  profile: TtsVoiceProfile;
  anchorX: number;
  anchorY: number;
  onEditSettings: () => void;
  onClose: () => void;
}

export default function VoiceProfileContextMenu({
  profile,
  anchorX,
  anchorY,
  onEditSettings,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchorX, top: anchorY });

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = anchorX;
    let top = anchorY;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setPosition({ left, top });
  }, [anchorX, anchorY]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Menu profilu ${profile.name}`}
      className="fixed z-[200] min-w-[200px] py-1 rounded-lg border border-border bg-panel shadow-lg text-sm"
      style={{ left: position.left, top: position.top }}
    >
      <p className="px-3 py-1.5 text-[10px] text-muted truncate border-b border-border/80" title={profile.name}>
        {profile.name}
      </p>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 hover:bg-panel2/80 text-foreground transition-colors"
        onClick={() => {
          onEditSettings();
          onClose();
        }}
      >
        Edytuj ustawienia profilu…
      </button>
    </div>
  );
}
