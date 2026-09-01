import { useCallback, useEffect, useMemo, useState } from "react";
import type { TtsVoiceProfile } from "../appSettings";
import type { Generation } from "../types";
import {
  BUILTIN_WHATSAPP_TEMPLATE_ID,
  type VideoCanvas,
  type VideoLayer,
  type VideoLayerType,
  type VideoTemplate,
} from "../types/videoTemplate";
import { LAYER_LABELS } from "../types/videoTemplate";
import { useVideoTemplatePicker } from "../hooks/useVideoTemplatePicker";
import {
  getVideoTemplate,
  saveVideoTemplate,
} from "../lib/videoTemplates";
import {
  canonicalizeVideoLayer,
  normalizeLayerPatch,
  normalizeVideoTemplate,
} from "../lib/videoTemplateRect";
import { ADD_LAYER_OPTIONS, createDefaultLayer } from "../lib/videoLayerFactory";
import { resolveProfileForGeneration } from "../lib/voiceProfiles";
import { displayTitle } from "../lib/generationTitle";
import { formatDurationMs, formatGenerationMs } from "../lib/formatTime";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { isGenerationPlayable } from "../lib/generationPlayback";
import Icon from "../components/Icon";
import VideoTemplateCanvas from "../components/video/VideoTemplateCanvas";
import VideoLayerInspector from "../components/video/VideoLayerInspector";
import VideoCanvasBackgroundFields from "../components/video/VideoCanvasBackgroundFields";
import Mp4LogPanel from "./Mp4LogPanel";
import Mp4GenerationPreview from "./Mp4GenerationPreview";
import { useMp4Export } from "./useMp4Export";

interface Props {
  initialGenerationId: string | null;
  generations: Generation[];
  voiceProfiles?: TtsVoiceProfile[];
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
  onClose?: () => void;
}

const DEFAULT_ZOOM = 0.6;

function findGeneration(
  id: string | null,
  generations: Generation[],
): Generation | null {
  if (!id) return null;
  return generations.find((g) => g.id === id) ?? null;
}

export default function Mp4StudioView({
  initialGenerationId,
  generations,
  voiceProfiles = [],
  onError,
  onToast,
  onClose,
}: Props) {
  const {
    templates,
    selectedId,
    setSelectedId,
    loading: pickerLoading,
    refresh: refreshPicker,
  } = useVideoTemplatePicker();
  const [template, setTemplate] = useState<VideoTemplate | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [dirty, setDirty] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [layoutConfirmed, setLayoutConfirmed] = useState(false);

  const generation = useMemo(
    () => findGeneration(initialGenerationId, generations),
    [initialGenerationId, generations],
  );

  // Load template body when the user picks one.
  useEffect(() => {
    const id = selectedId || BUILTIN_WHATSAPP_TEMPLATE_ID;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const tpl = await getVideoTemplate(id);
        if (cancelled) return;
        setTemplate(normalizeVideoTemplate(tpl));
        setSelectedLayerId(tpl.layers[0]?.id ?? null);
        setDirty(false);
        setLayoutConfirmed(false);
      } catch (e) {
        onError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, onError]);

  // When the generation changes (e.g. a different history row was opened),
  // reset the "confirmed" state so the user re-confirms the layout.
  useEffect(() => {
    setLayoutConfirmed(false);
  }, [initialGenerationId]);

  const handleTemplateChange = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDirty(false);
    },
    [setSelectedId],
  );

  const updateLayer = useCallback(
    (layerId: string, patch: Partial<VideoLayer>) => {
      setTemplate((prev) => {
        if (!prev) return prev;
        setDirty(true);
        const layer = prev.layers.find((l) => l.id === layerId);
        const normalized = layer
          ? normalizeLayerPatch(patch, layer, prev.canvas.width, prev.canvas.height)
          : patch;
        return {
          ...prev,
          layers: prev.layers.map((l) =>
            l.id === layerId
              ? canonicalizeVideoLayer({ ...l, ...normalized } as VideoLayer)
              : l,
          ),
        };
      });
      setLayoutConfirmed(false);
    },
    [],
  );

  const updateCanvas = useCallback((patch: Partial<VideoCanvas>) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return { ...prev, canvas: { ...prev.canvas, ...patch } };
    });
    setLayoutConfirmed(false);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!template) return;
    setSavingTemplate(true);
    try {
      const saved = await saveVideoTemplate(normalizeVideoTemplate(template));
      setTemplate(saved);
      setDirty(false);
      void refreshPicker();
      onToast?.("Szablon zapisany.");
    } catch (e) {
      onError(String(e));
    } finally {
      setSavingTemplate(false);
    }
  }, [template, onToast, onError, refreshPicker]);

  const handleAddLayer = useCallback(
    (type: VideoLayerType) => {
      if (!template) return;
      const layer = createDefaultLayer(type, template.canvas.width, template.canvas.height);
      setTemplate((prev) =>
        prev
          ? {
              ...prev,
              layers: [...prev.layers, layer],
            }
          : prev,
      );
      setSelectedLayerId(layer.id);
      setDirty(true);
      setLayoutConfirmed(false);
    },
    [template],
  );

  const handleRemoveLayer = useCallback(() => {
    if (!template || !selectedLayerId || template.layers.length <= 1) return;
    setTemplate((prev) => {
      if (!prev) return prev;
      const layers = prev.layers.filter((l) => l.id !== selectedLayerId);
      setSelectedLayerId(layers[layers.length - 1]?.id ?? null);
      return { ...prev, layers };
    });
    setDirty(true);
    setLayoutConfirmed(false);
  }, [template, selectedLayerId]);

  const handleMoveLayer = useCallback(
    (direction: "up" | "down") => {
      if (!template || !selectedLayerId) return;
      setTemplate((prev) => {
        if (!prev) return prev;
        const idx = prev.layers.findIndex((l) => l.id === selectedLayerId);
        if (idx < 0) return prev;
        const target = direction === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= prev.layers.length) return prev;
        const next = [...prev.layers];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...prev, layers: next };
      });
      setDirty(true);
      setLayoutConfirmed(false);
    },
    [template, selectedLayerId],
  );

  const { state, liveEtaMs, startCopy, startSave, reset } = useMp4Export({
    generation,
    voiceProfiles,
    templateId: selectedId || null,
  });

  // Empty / missing generation.
  if (!initialGenerationId) {
    return (
      <div className="mp4-studio-empty h-full flex items-center justify-center text-center p-6">
        <div className="max-w-md space-y-3">
          <Icon name="film" size={42} className="mx-auto text-muted opacity-60" />
          <h2 className="text-lg font-semibold">Studio MP4</h2>
          <p className="text-sm text-muted">
            Wybierz generację z Historii (PPM → <em>Studio MP4</em> lub ikona
            <Icon name="film" size={14} className="inline align-text-bottom mx-1" />
            na kafelku), aby przygotować i wyeksportować wideo MP4 z wybranym
            layoutem.
          </p>
        </div>
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="mp4-studio-missing h-full flex items-center justify-center text-center p-6">
        <div className="max-w-md space-y-3">
          <p className="text-sm text-red-300">
            Nie znaleziono generacji o id <code>{initialGenerationId}</code>.
          </p>
          <p className="text-xs text-muted">
            Mogła zostać usunięta. Wróć do Historii i wybierz inną.
          </p>
          {onClose && (
            <button type="button" className="btn" onClick={onClose}>
              Wróć
            </button>
          )}
        </div>
      </div>
    );
  }

  const playable = isGenerationPlayable(generation);
  const titleLabel = displayTitle(generation);
  const profile = resolveProfileForGeneration(generation, voiceProfiles);
  const voiceLabel =
    profile?.name ?? generation.voice?.trim() ?? "Profil usunięty";
  const busy = state.phase === "starting" || state.phase === "render";
  const showActionButtons = layoutConfirmed && !busy && playable;

  const headerExtras: string[] = [];
  if (generation.duration_ms && generation.duration_ms > 0) {
    headerExtras.push(`audio ${formatDurationMs(generation.duration_ms)}`);
  }
  const genTime = formatGenerationMs(generation.generation_ms);
  if (genTime) headerExtras.push(`gen. ${genTime}`);
  if (generation.input_chars != null) {
    headerExtras.push(`${generation.input_chars} zn`);
  }

  return (
    <div className="mp4-studio-view flex flex-col h-full min-h-0">
      <header className="flex items-start gap-3 border-b border-border bg-panel/60 p-3 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="film" size={20} className="text-accent shrink-0" />
            <h1 className="text-base font-semibold truncate" title={titleLabel}>
              Studio MP4 · {titleLabel}
            </h1>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted truncate" title={voiceLabel}>
              {voiceLabel}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted flex-wrap">
            <span>{headerExtras.join(" · ") || "—"}</span>
            <span>·</span>
            <span>{generation.model}</span>
            {generation.provider && (
              <>
                <span>·</span>
                <span>{generation.provider}</span>
              </>
            )}
            {!playable && (
              <span className="text-amber-300">
                {isMockUiMode()
                  ? "(tryb mock — eksport niedostępny)"
                  : generation.status !== "done"
                    ? `(status: ${generation.status})`
                    : "Brak pliku audio"}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="btn text-xs shrink-0"
            onClick={onClose}
            title="Zamknij studio MP4"
          >
            ← Wróć
          </button>
        )}
      </header>

      <div className="shrink-0 px-3 pt-3">
        <Mp4GenerationPreview
          generation={generation}
          voiceProfiles={voiceProfiles}
        />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_360px] gap-3 p-3 overflow-hidden">
        {/* Layout preview + editor */}
        <section className="flex flex-col gap-3 min-w-0 min-h-0 overflow-auto">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              Szablon
              <select
                className="input text-xs"
                value={selectedId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={pickerLoading || templates.length === 0 || busy}
                aria-label="Szablon MP4"
              >
                {templates.length === 0 ? (
                  <option value={selectedId}>Domyślny…</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isBuiltin ? " (wbud.)" : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              className="btn text-xs"
              disabled={!dirty || !template || savingTemplate}
              onClick={() => void handleSaveTemplate()}
            >
              {savingTemplate ? "Zapisuję…" : "Zapisz szablon"}
            </button>
            <span className="text-[10px] text-muted">
              {dirty ? "Masz niezapisane zmiany" : "Bez zmian"}
            </span>
            <span className="flex-1" />
            <label className="flex items-center gap-2 text-xs text-muted">
              Zoom
              <input
                type="range"
                min={0.3}
                max={1.0}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={busy}
              />
            </label>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3 min-h-[420px]">
            <div className="min-w-0 flex items-start justify-center overflow-auto rounded-lg border border-border bg-black/20 p-4">
              {template ? (
                <VideoTemplateCanvas
                  template={template}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onUpdateLayer={updateLayer}
                  zoom={zoom}
                />
              ) : (
                <p className="text-sm text-muted self-center">Ładowanie szablonu…</p>
              )}
            </div>
            <aside className="flex flex-col gap-3 min-w-0 overflow-y-auto">
              {template && (
                <VideoCanvasBackgroundFields canvas={template.canvas} onChange={updateCanvas} />
              )}
              <div className="border border-border rounded-lg p-2 bg-panel2/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase text-muted font-semibold">Warstwy</p>
                  {selectedLayerId && template && template.layers.length > 1 && (
                    <button
                      type="button"
                      className="text-[10px] text-red-300 hover:text-red-200 disabled:opacity-40"
                      onClick={handleRemoveLayer}
                      title="Usuń zaznaczoną warstwę"
                    >
                      Usuń
                    </button>
                  )}
                </div>
                {selectedLayerId && template && (
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      className="btn text-[10px] py-0.5 px-2 flex-1"
                      onClick={() => handleMoveLayer("up")}
                      disabled={
                        !template ||
                        template.layers.findIndex((l) => l.id === selectedLayerId) <= 0
                      }
                      title="Przenieś wyżej (na wierzch)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn text-[10px] py-0.5 px-2 flex-1"
                      onClick={() => handleMoveLayer("down")}
                      disabled={
                        !template ||
                        template.layers.findIndex(
                          (l) => l.id === selectedLayerId,
                        ) >= template.layers.length - 1
                      }
                      title="Przenieś niżej (pod spód)"
                    >
                      ↓
                    </button>
                  </div>
                )}
                <ul className="flex flex-col gap-1">
                  {template?.layers.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={[
                          "w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2",
                          selectedLayerId === l.id ? "bg-accent/20" : "hover:bg-panel2",
                        ].join(" ")}
                        onClick={() => setSelectedLayerId(l.id)}
                      >
                        <Icon name="clip-insert" size={12} />
                        <span className="truncate">{LAYER_LABELS[l.type]}</span>
                        {!l.visible && <span className="text-muted ml-auto shrink-0">ukryta</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {template && (
                  <div className="border-t border-border mt-2 pt-2">
                    <p className="text-[10px] uppercase text-muted font-semibold mb-1.5">
                      Dodaj warstwę
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {ADD_LAYER_OPTIONS.map(({ type, label }) => (
                        <button
                          key={type}
                          type="button"
                          className="btn text-[10px] py-0.5 px-1.5"
                          onClick={() => handleAddLayer(type)}
                          disabled={busy}
                          title={`Dodaj: ${label}`}
                        >
                          + {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <VideoLayerInspector
                layer={template?.layers.find((l) => l.id === selectedLayerId) ?? null}
                canvasWidth={template?.canvas.width ?? 720}
                canvasHeight={template?.canvas.height ?? 720}
                onChange={(patch) => {
                  if (selectedLayerId) updateLayer(selectedLayerId, patch);
                }}
              />
            </aside>
          </div>
        </section>

        {/* Action + log panel */}
        <aside className="flex flex-col gap-3 min-w-0 min-h-0">
          <div className="border border-border rounded-lg bg-panel2/40 p-3 flex flex-col gap-2 shrink-0">
            <p className="text-xs uppercase font-semibold text-muted">Eksport MP4</p>
            <p className="text-[11px] text-muted leading-snug">
              {layoutConfirmed
                ? "Wybierz akcję. Generacja zostanie wyrenderowana przez ffmpeg."
                : "Dostosuj layout i kliknij „Generuj MP4”, aby potwierdzić i ujawnić akcje."}
            </p>
            <button
              type="button"
              className="btn w-full"
              disabled={!playable || !template || busy}
              onClick={() => {
                if (!playable) {
                  onError("Ta generacja nie jest gotowa do eksportu MP4.");
                  return;
                }
                if (state.phase === "done" || state.phase === "error") {
                  reset();
                }
                setLayoutConfirmed(true);
              }}
            >
              {layoutConfirmed ? "✓ Layout potwierdzony" : "Generuj MP4"}
            </button>
            {showActionButtons && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={!playable || !template || busy}
                  onClick={() => void startCopy()}
                  data-testid="mp4-action-copy"
                >
                  Kopiuj do schowka
                </button>
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={!playable || !template || busy}
                  onClick={() => void startSave()}
                  data-testid="mp4-action-save"
                >
                  Zapisz na dysk
                </button>
              </div>
            )}
            {dirty && (
              <p className="text-[10px] text-amber-300">
                Uwaga: eksport użyje niezapisanych zmian szablonu w pamięci.
              </p>
            )}
          </div>

          <Mp4LogPanel
            state={state}
            liveEtaMs={liveEtaMs}
            showEtaWhenIdle
            className="flex-1 min-h-0 overflow-y-auto"
          />
        </aside>
      </div>
    </div>
  );
}
