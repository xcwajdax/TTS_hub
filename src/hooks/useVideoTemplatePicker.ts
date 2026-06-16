import { useCallback, useEffect, useState } from "react";
import { getAppSettings } from "../api/tauri";
import { listVideoTemplates } from "../lib/videoTemplates";
import { BUILTIN_WHATSAPP_TEMPLATE_ID, type VideoTemplateMeta } from "../types/videoTemplate";

const STORAGE_KEY = "tts-hub.mp4.selected-template-id";

export function loadStoredVideoTemplateId(): string | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function storeVideoTemplateId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function useVideoTemplatePicker() {
  const [templates, setTemplates] = useState<VideoTemplateMeta[]>([]);
  const [selectedId, setSelectedIdState] = useState<string>(
    () => loadStoredVideoTemplateId() ?? BUILTIN_WHATSAPP_TEMPLATE_ID,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [metas, settings] = await Promise.all([listVideoTemplates(), getAppSettings()]);
      setTemplates(metas);
      const defaultId =
        settings.default_video_template_id?.trim() || BUILTIN_WHATSAPP_TEMPLATE_ID;
      const stored = loadStoredVideoTemplateId();
      const pick =
        stored && metas.some((m) => m.id === stored)
          ? stored
          : metas.some((m) => m.id === defaultId)
            ? defaultId
            : (metas[0]?.id ?? BUILTIN_WHATSAPP_TEMPLATE_ID);
      setSelectedIdState(pick);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    storeVideoTemplateId(id);
  }, []);

  const selectedMeta = templates.find((t) => t.id === selectedId) ?? null;

  return {
    templates,
    selectedId,
    selectedMeta,
    setSelectedId,
    loading,
    refresh,
  };
}
