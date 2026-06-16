import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { VideoLayer, VideoLayerType, VideoTemplate, VideoTemplateMeta } from "../../types/videoTemplate";
import { BUILTIN_WHATSAPP_TEMPLATE_ID, LAYER_LABELS } from "../../types/videoTemplate";
import {
  deleteVideoTemplate,
  duplicateVideoTemplate,
  getVideoTemplate,
  listVideoTemplates,
  newVideoTemplateFromPreset,
  previewVideoTemplateFrame,
  saveVideoTemplate,
} from "../../lib/videoTemplates";
import { ADD_LAYER_OPTIONS, createDefaultLayer } from "../../lib/videoLayerFactory";
import { normalizeLayerPatch, normalizeVideoTemplate } from "../../lib/videoTemplateRect";
import VideoTemplateCanvas from "./VideoTemplateCanvas";
import VideoLayerInspector from "./VideoLayerInspector";
import Icon from "../Icon";

interface Props {
  defaultTemplateId?: string | null;
  autoArchive?: boolean;
  onDefaultTemplateChange?: (id: string) => void;
  onAutoArchiveChange?: (value: boolean) => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export default function VideoTemplateCreator({
  defaultTemplateId,
  autoArchive = true,
  onDefaultTemplateChange,
  onAutoArchiveChange,
  onError,
  onSuccess,
}: Props) {
  const [metas, setMetas] = useState<VideoTemplateMeta[]>([]);
  const [template, setTemplate] = useState<VideoTemplate | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [busy, setBusy] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const refreshList = useCallback(async () => {
    try {
      const list = await listVideoTemplates();
      setMetas(list);
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  const loadTemplate = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        const tpl = await getVideoTemplate(id);
        setTemplate(tpl);
        setSelectedLayerId(tpl.layers[0]?.id ?? null);
        setPreviewPath(null);
        setDirty(false);
      } catch (e) {
        onError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    void refreshList();
    const initial = defaultTemplateId ?? BUILTIN_WHATSAPP_TEMPLATE_ID;
    void loadTemplate(initial);
  }, [defaultTemplateId, loadTemplate, refreshList]);

  const updateLayer = (layerId: string, patch: Partial<VideoLayer>) => {
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
          l.id === layerId ? ({ ...l, ...normalized } as VideoLayer) : l,
        ),
      };
    });
  };

  const addLayer = (type: VideoLayerType) => {
    if (!template) return;
    const layer = createDefaultLayer(type, template.canvas.width, template.canvas.height);
    setTemplate({ ...template, layers: [...template.layers, layer] });
    setSelectedLayerId(layer.id);
    setDirty(true);
  };

  const removeLayer = (layerId: string) => {
    if (!template || template.layers.length <= 1) return;
    setTemplate({
      ...template,
      layers: template.layers.filter((l) => l.id !== layerId),
    });
    if (selectedLayerId === layerId) {
      setSelectedLayerId(template.layers.find((l) => l.id !== layerId)?.id ?? null);
    }
    setDirty(true);
  };

  const moveLayer = (layerId: string, direction: "up" | "down") => {
    if (!template) return;
    const idx = template.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const next = direction === "up" ? idx - 1 : idx + 1;
    if (next < 0 || next >= template.layers.length) return;
    const layers = [...template.layers];
    [layers[idx], layers[next]] = [layers[next], layers[idx]];
    setTemplate({ ...template, layers });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!template) return;
    setBusy(true);
    try {
      const saved = await saveVideoTemplate(normalizeVideoTemplate(template));
      setTemplate(saved);
      setDirty(false);
      await refreshList();
      onSuccess?.("Szablon zapisany.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;
    const name = window.prompt("Nazwa kopii szablonu:", `${template.name} (kopia)`);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const copy = await duplicateVideoTemplate(template.id, name.trim());
      await refreshList();
      await loadTemplate(copy.id);
      onSuccess?.("Utworzono kopię szablonu.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!template || template.id === BUILTIN_WHATSAPP_TEMPLATE_ID) return;
    if (!window.confirm(`Usunąć szablon „${template.name}”?`)) return;
    setBusy(true);
    try {
      await deleteVideoTemplate(template.id);
      await refreshList();
      await loadTemplate(BUILTIN_WHATSAPP_TEMPLATE_ID);
      onSuccess?.("Szablon usunięty.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleNewPreset = async (preset: "whatsapp" | "portrait-916" | "landscape-169") => {
    const name = window.prompt("Nazwa nowego szablonu:");
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const tpl = await newVideoTemplateFromPreset(preset, name.trim());
      await refreshList();
      await loadTemplate(tpl.id);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!template) return;
    setBusy(true);
    try {
      const path = await previewVideoTemplateFrame(normalizeVideoTemplate(template));
      setPreviewPath(path);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedLayer = template?.layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <div className="video-template-creator flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className="btn text-xs" disabled={busy || !dirty} onClick={() => void handleSave()}>
          Zapisz
        </button>
        <button type="button" className="btn text-xs" disabled={busy || !template} onClick={() => void handleDuplicate()}>
          Duplikuj
        </button>
        <button
          type="button"
          className="btn text-xs"
          disabled={busy || !template || template.id === BUILTIN_WHATSAPP_TEMPLATE_ID}
          onClick={() => void handleDelete()}
        >
          Usuń
        </button>
        <button type="button" className="btn text-xs" disabled={busy || !template} onClick={() => void handlePreview()}>
          Podgląd ffmpeg
        </button>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-muted">
          Zoom
          <input
            type="range"
            min={0.4}
            max={1.2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="grid grid-cols-[180px_minmax(0,1fr)_240px] gap-4 min-h-[420px]">
        <aside className="flex flex-col gap-2 min-w-0 border border-border rounded-lg p-2 bg-panel2/30">
          <p className="text-[10px] uppercase text-muted font-semibold px-1">Szablony</p>
          <ul className="flex flex-col gap-0.5 overflow-y-auto max-h-[280px]">
            {metas.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={[
                    "w-full text-left text-xs px-2 py-1.5 rounded truncate",
                    template?.id === m.id ? "bg-accent/20 text-heading" : "hover:bg-panel2",
                  ].join(" ")}
                  onClick={() => void loadTemplate(m.id)}
                >
                  {m.name}
                  {m.isBuiltin ? " · wbud." : ""}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-2 flex flex-col gap-1">
            <button type="button" className="btn text-[10px] py-1" onClick={() => void handleNewPreset("whatsapp")}>
              + WhatsApp
            </button>
            <button type="button" className="btn text-[10px] py-1" onClick={() => void handleNewPreset("portrait-916")}>
              + Pion 9:16
            </button>
            <button type="button" className="btn text-[10px] py-1" onClick={() => void handleNewPreset("landscape-169")}>
              + Poziom 16:9
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex flex-col items-center justify-start overflow-auto">
          {template ? (
            <VideoTemplateCanvas
              template={template}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={updateLayer}
              zoom={zoom}
            />
          ) : (
            <p className="text-sm text-muted">Ładowanie szablonu…</p>
          )}
          {previewPath && (
            <div className="mt-3 w-full max-w-md">
              <p className="text-[10px] text-muted mb-1">Podgląd renderu ffmpeg</p>
              <video
                src={convertFileSrc(previewPath)}
                controls
                className="w-full rounded border border-border"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div className="border border-border rounded-lg p-2 bg-panel2/30">
            <p className="text-[10px] uppercase text-muted font-semibold mb-2">Warstwy</p>
            <ul className="flex flex-col gap-1">
              {template?.layers.map((l, index) => (
                <li key={l.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className={[
                      "flex-1 min-w-0 text-left text-xs px-2 py-1 rounded flex items-center gap-2",
                      selectedLayerId === l.id ? "bg-accent/20" : "hover:bg-panel2",
                    ].join(" ")}
                    onClick={() => setSelectedLayerId(l.id)}
                  >
                    <Icon name="clip-insert" size={12} />
                    <span className="truncate">{LAYER_LABELS[l.type]}</span>
                    {!l.visible && <span className="text-muted ml-auto shrink-0">ukryta</span>}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 w-5 h-5 text-[10px] text-muted hover:text-accent disabled:opacity-30"
                    disabled={index === 0}
                    title="Wyżej (na wierzch)"
                    onClick={() => moveLayer(l.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="shrink-0 w-5 h-5 text-[10px] text-muted hover:text-accent disabled:opacity-30"
                    disabled={!template || index === template.layers.length - 1}
                    title="Niżej (pod spód)"
                    onClick={() => moveLayer(l.id, "down")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="shrink-0 w-5 h-5 text-[10px] text-muted hover:text-red-400 disabled:opacity-30"
                    disabled={!template || template.layers.length <= 1}
                    title="Usuń warstwę"
                    onClick={() => removeLayer(l.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-1">
              {ADD_LAYER_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  className="btn text-[9px] py-0.5 px-1.5"
                  onClick={() => addLayer(type)}
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
          <VideoLayerInspector
            layer={selectedLayer}
            canvasWidth={template?.canvas.width ?? 720}
            canvasHeight={template?.canvas.height ?? 720}
            onChange={(patch) => {
              if (selectedLayerId) updateLayer(selectedLayerId, patch);
            }}
          />
        </div>
      </div>

      {(onDefaultTemplateChange || onAutoArchiveChange) && (
        <div className="border border-border rounded-lg p-3 bg-panel2/30 flex flex-col gap-3 text-sm">
          <h3 className="font-semibold text-sm">Eksport MP4</h3>
          {onDefaultTemplateChange && template && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Domyślny szablon przy kopiowaniu MP4</span>
              <select
                className="input text-sm"
                value={defaultTemplateId ?? template.id}
                onChange={(e) => onDefaultTemplateChange(e.target.value)}
              >
                {metas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {onAutoArchiveChange && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoArchive}
                onChange={(e) => onAutoArchiveChange(e.target.checked)}
              />
              Auto-zapis do biblioteki Wideo po skopiowaniu MP4 do schowka
            </label>
          )}
        </div>
      )}
    </div>
  );
}
