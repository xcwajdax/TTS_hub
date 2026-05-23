import { useState } from "react";
import {
  exportSkin,
  installSkinArchive,
  openSkinsFolder,
  pickSkinArchive,
  pickSkinExportPath,
} from "../api/tauri";
import { useTimelineView } from "../context/TimelineViewContext";
import type { TimelineViewMode } from "../lib/timelineView";
import {
  TIMELINE_VIEW_DESCRIPTIONS,
  TIMELINE_VIEW_LABELS,
  TIMELINE_VIEW_MODES,
} from "../lib/timelineView";
import { persistActiveSkinId } from "../skins/persistActiveSkin";
import { useSkin } from "../skins/SkinProvider";
import { BUILTIN_SKINS } from "../skins/builtin";
import { getSkinTimelineViewPreference } from "../skins/skinPreferences";
import { resolveTokens } from "../skins/tokens";
import type { SkinListEntry } from "../skins/types";

interface Props {
  activeSkinId: string;
  onSelectSkin: (id: string) => void;
  timelineView: TimelineViewMode;
  onTimelineViewChange: (mode: TimelineViewMode) => void;
  onError: (message: string) => void;
}

function SkinPreviewSwatch({ entry }: { entry: SkinListEntry }) {
  const builtin = BUILTIN_SKINS.find((s) => s.manifest.id === entry.id);
  const tokens = builtin
    ? resolveTokens(builtin.manifest)
    : {
        "color-bg": "15 17 21",
        "color-accent": "124 92 255",
        "color-panel": "23 26 33",
      };

  const swatch = (key: string) => {
    const v = tokens[key];
    if (!v || v.includes("gradient") || v.includes("linear")) {
      return `rgb(${tokens["color-bg"] ?? "0 0 0"})`;
    }
    return `rgb(${v})`;
  };

  return (
    <span
      className="inline-flex h-6 w-14 rounded overflow-hidden border border-border shrink-0"
      aria-hidden
    >
      <span className="flex-1" style={{ background: swatch("color-bg") }} />
      <span className="flex-1" style={{ background: swatch("color-panel") }} />
      <span className="flex-1" style={{ background: swatch("color-accent") }} />
    </span>
  );
}

export default function AppearancePanel({
  activeSkinId,
  onSelectSkin,
  timelineView,
  onTimelineViewChange,
  onError,
}: Props) {
  const { availableSkins, setSkin, refreshSkins } = useSkin();
  const { setMode: persistTimelineMode, applySkinPreference } = useTimelineView();
  const [busy, setBusy] = useState(false);

  const activeEntry = availableSkins.find((s) => s.id === activeSkinId);
  const isBuiltin = activeEntry?.source === "builtin";

  const skinManifestFor = (id: string) =>
    BUILTIN_SKINS.find((s) => s.manifest.id === id)?.manifest;

  const applySkin = async (id: string) => {
    const ok = await setSkin(id);
    if (!ok) {
      onError(`Nie udało się zastosować skórki „${id}”`);
      return;
    }
    onSelectSkin(id);
    const manifest = skinManifestFor(id);
    if (manifest) {
      const pref = getSkinTimelineViewPreference(manifest);
      if (pref) {
        onTimelineViewChange(pref);
        applySkinPreference(manifest);
      }
    }
    try {
      await persistActiveSkinId(id);
    } catch (e) {
      onError(`Skórka włączona, ale zapis ustawień nie powiódł się: ${e}`);
    }
  };

  const selectTimelineView = (mode: TimelineViewMode) => {
    onTimelineViewChange(mode);
    void persistTimelineMode(mode);
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const path = await pickSkinArchive();
      if (!path) return;
      try {
        await installSkinArchive(path, false);
      } catch (e) {
        const msg = String(e);
        if (msg.includes("już istnieje")) {
          if (!window.confirm("Skórka o tym id już istnieje. Nadpisać?")) return;
          await installSkinArchive(path, true);
        } else {
          throw e;
        }
      }
      await refreshSkins();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (isBuiltin) {
      onError(
        "Skórki wbudowane są częścią aplikacji — eksport dotyczy skórek użytkownika w folderze skins.",
      );
      return;
    }
    setBusy(true);
    try {
      const dest = await pickSkinExportPath(activeSkinId);
      if (!dest) return;
      await exportSkin(activeSkinId, dest);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Aktywna skórka</h3>
        <p className="text-[11px] text-muted">
          Wybór skórki zapisuje się od razu. Pełne ustawienia zapisujesz przyciskiem „Zapisz” w modalu.
        </p>
        <ul className="flex flex-col gap-2">
          {availableSkins.map((entry) => {
            const selected = entry.id === activeSkinId;
            return (
              <li key={`${entry.source}-${entry.id}`}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applySkin(entry.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors ${
                    selected
                      ? "border-accent bg-panel2 skin-glow-accent"
                      : "border-border bg-panel/50 hover:border-border hover:bg-panel2"
                  }`}
                >
                  <SkinPreviewSwatch entry={entry} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{entry.name}</span>
                    <span className="block text-[11px] text-muted truncate">
                      {entry.author} · v{entry.version}
                      {entry.source === "builtin" ? " · wbudowana" : " · własna"}
                    </span>
                  </span>
                  {selected && (
                    <span className="text-[10px] uppercase tracking-wider text-accent shrink-0">
                      Aktywna
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-xs uppercase tracking-wide text-muted">Timeline odtwarzacza</h3>
        <p className="text-[11px] text-muted">
          Wygląd dolnego paska z falą dźwiękową. Możesz też zmienić go prawym przyciskiem myszy na
          timeline. Aktywna skórka może ustawić domyślny widok przy przełączeniu.
        </p>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Wygląd timeline">
          {TIMELINE_VIEW_MODES.map((id) => {
            const selected = timelineView === id;
            return (
              <label
                key={id}
                className={`flex items-start gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                  selected
                    ? "border-accent bg-panel2"
                    : "border-border bg-panel/50 hover:bg-panel2"
                }`}
              >
                <input
                  type="radio"
                  name="timeline-view"
                  className="mt-0.5 accent-[rgb(var(--color-accent2))]"
                  checked={selected}
                  onChange={() => selectTimelineView(id)}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{TIMELINE_VIEW_LABELS[id]}</span>
                  <span className="block text-[10px] text-muted">{TIMELINE_VIEW_DESCRIPTIONS[id]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button type="button" className="btn text-xs" disabled={busy} onClick={() => void handleImport()}>
          Importuj skórkę…
        </button>
        <button
          type="button"
          className="btn text-xs"
          disabled={busy || isBuiltin}
          onClick={() => void handleExport()}
          title={isBuiltin ? "Eksport tylko dla skórek własnych" : undefined}
        >
          Eksportuj aktywną…
        </button>
        <button
          type="button"
          className="btn text-xs"
          disabled={busy}
          onClick={() => void openSkinsFolder().catch((e) => onError(String(e)))}
        >
          Otwórz folder skórek
        </button>
      </section>

      <p className="text-[11px] text-muted border-t border-border pt-3">
        Rejestr skórek online — wkrótce. Pole <code className="text-ink/80">skin_registry_urls</code> w
        ustawieniach jest przygotowane pod przyszłą wersję.
      </p>
    </div>
  );
}
