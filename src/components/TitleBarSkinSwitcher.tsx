import { useCallback, useState } from "react";
import { useTimelineView } from "../context/TimelineViewContext";
import { BUILTIN_SKIN_IDS, BUILTIN_SKINS } from "../skins/builtin";
import { persistActiveSkinId } from "../skins/persistActiveSkin";
import { useSkin } from "../skins/SkinProvider";
import { resolveTokens } from "../skins/tokens";

function skinSwatchRgb(id: string, key: string): string {
  const builtin = BUILTIN_SKINS.find((s) => s.manifest.id === id);
  const tokens = builtin ? resolveTokens(builtin.manifest) : {};
  const v = tokens[key];
  if (!v || v.includes("gradient") || v.includes("linear")) {
    return `rgb(${tokens["color-bg"] ?? "0 0 0"})`;
  }
  return `rgb(${v})`;
}

const SKIN_LABELS: Record<(typeof BUILTIN_SKIN_IDS)[number], string> = {
  vibelife: "VIBELIFE",
  matrix: "Matrix",
  "light-zen": "Light",
};

export default function TitleBarSkinSwitcher() {
  const { activeSkinId, setSkin } = useSkin();
  const { applySkinPreference } = useTimelineView();
  const [busy, setBusy] = useState(false);

  const applySkin = useCallback(
    async (id: (typeof BUILTIN_SKIN_IDS)[number]) => {
      if (busy || activeSkinId === id) return;
      setBusy(true);
      try {
        const ok = await setSkin(id);
        if (!ok) return;
        const manifest = BUILTIN_SKINS.find((s) => s.manifest.id === id)?.manifest;
        if (manifest) applySkinPreference(manifest);
        await persistActiveSkinId(id);
      } finally {
        setBusy(false);
      }
    },
    [activeSkinId, applySkinPreference, busy, setSkin],
  );

  return (
    <div
      className="title-bar__skins"
      role="group"
      aria-label="Skórka wyglądu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {BUILTIN_SKIN_IDS.map((id) => {
        const active = activeSkinId === id;
        return (
          <button
            key={id}
            type="button"
            disabled={busy}
            className={`title-bar__skin-btn ${active ? "title-bar__skin-btn--active" : ""}`}
            onClick={() => void applySkin(id)}
            aria-pressed={active}
            title={SKIN_LABELS[id]}
          >
            <span className="title-bar__skin-swatch" aria-hidden>
              <span style={{ background: skinSwatchRgb(id, "color-bg") }} />
              <span style={{ background: skinSwatchRgb(id, "color-accent") }} />
            </span>
            <span className="title-bar__skin-label">{SKIN_LABELS[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
