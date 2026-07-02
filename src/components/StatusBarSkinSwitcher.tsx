import { useCallback, useRef, useState } from "react";
import { useTimelineView } from "../context/TimelineViewContext";
import { BUILTIN_SKIN_IDS, BUILTIN_SKINS } from "../skins/builtin";
import { persistActiveSkinId } from "../skins/persistActiveSkin";
import { useSkin } from "../skins/SkinProvider";
import { SKIN_SHORT_LABELS, skinSwatchRgb } from "../skins/skinSwatch";
import { useSkinTransition } from "../skins/transition/SkinTransitionProvider";

interface Props {
  onOpenAppearance?: () => void;
}

function PaletteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className="status-bar__palette-icon">
      <path
        fill="currentColor"
        d="M12 3a9 9 0 0 0-4 15.9V21a1 1 0 0 0 2 0v-1.1A9 9 0 0 0 12 3Zm-4.2 12.2a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm2.1-4.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4.2 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm2.1 4.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
      />
    </svg>
  );
}

export default function StatusBarSkinSwitcher({ onOpenAppearance }: Props) {
  const { activeSkinId, setSkin } = useSkin();
  const { playTransition, busy: transitionBusy } = useSkinTransition();
  const { applySkinPreference } = useTimelineView();
  const [busy, setBusy] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const applySkin = useCallback(
    async (id: (typeof BUILTIN_SKIN_IDS)[number], origin: { x: number; y: number }) => {
      if (busy || transitionBusy || activeSkinId === id) return;

      const doApply = async () => {
        const ok = await setSkin(id);
        if (!ok) return;
        const manifest = BUILTIN_SKINS.find((s) => s.manifest.id === id)?.manifest;
        if (manifest) applySkinPreference(manifest);
        await persistActiveSkinId(id);
      };

      setBusy(true);
      try {
        await playTransition({
          origin,
          fromSkinId: activeSkinId,
          toSkinId: id,
          applySkin: doApply,
        });
      } finally {
        setBusy(false);
      }
    },
    [activeSkinId, applySkinPreference, busy, playTransition, setSkin, transitionBusy],
  );

  return (
    <div
      ref={groupRef}
      className="status-bar__chrome status-bar__skins"
      role="group"
      aria-label="Skórka wyglądu"
    >
      {BUILTIN_SKIN_IDS.map((id) => {
        const active = activeSkinId === id;
        const label = SKIN_SHORT_LABELS[id] ?? id;
        return (
          <button
            key={id}
            type="button"
            disabled={busy || transitionBusy}
            className={`status-bar__skin-btn ${active ? "status-bar__skin-btn--active" : ""}`}
            onClick={(e) =>
              void applySkin(id, { x: e.clientX, y: e.clientY })
            }
            aria-pressed={active}
            aria-label={`Skórka ${label}`}
            data-skin-label={label}
            title={label}
          >
            <span className="status-bar__skin-swatch" aria-hidden>
              <span style={{ background: skinSwatchRgb(id, "color-bg") }} />
              <span style={{ background: skinSwatchRgb(id, "color-panel") }} />
              <span style={{ background: skinSwatchRgb(id, "color-accent") }} />
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className="status-bar__skin-palette"
        onClick={() => onOpenAppearance?.()}
        aria-label="Ustawienia skórek i wyglądu"
        title="Ustawienia skórek…"
      >
        <PaletteIcon />
      </button>
    </div>
  );
}
