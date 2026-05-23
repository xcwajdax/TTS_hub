import { useCallback, useEffect, useState } from "react";
import {
  getVoiceAvatar,
  listSourceAvatars,
  type AvatarInfo,
} from "../api/tauri";
import { AVATARS_CHANGED } from "../lib/avatars";
import type { GenerationSource, TtsProvider } from "../types";

export function useSourceAvatars(): Record<GenerationSource, string> {
  const [paths, setPaths] = useState<Record<GenerationSource, string>>({} as Record<GenerationSource, string>);

  const refresh = useCallback(() => {
    listSourceAvatars()
      .then((map) => setPaths(map as Record<GenerationSource, string>))
      .catch(() => setPaths({} as Record<GenerationSource, string>));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(AVATARS_CHANGED, refresh);
    return () => window.removeEventListener(AVATARS_CHANGED, refresh);
  }, [refresh]);

  return paths;
}

export function useVoiceAvatar(provider: TtsProvider, voiceId: string): AvatarInfo | null {
  const [info, setInfo] = useState<AvatarInfo | null>(null);

  const refresh = useCallback(() => {
    if (!voiceId.trim()) {
      setInfo(null);
      return;
    }
    getVoiceAvatar(provider, voiceId)
      .then(setInfo)
      .catch(() => setInfo({ exists: false, path: null }));
  }, [provider, voiceId]);

  useEffect(() => {
    refresh();
    window.addEventListener(AVATARS_CHANGED, refresh);
    return () => window.removeEventListener(AVATARS_CHANGED, refresh);
  }, [refresh]);

  return info;
}
