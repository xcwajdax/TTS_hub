import { useCallback, useEffect, useRef } from "react";
import type { SelectOptions } from "../context/PlaybackContext";
import type { Generation } from "../types";

interface SnoozeEntry {
  timeoutId: number;
  title: string;
}

export function usePlaybackSnooze(
  select: (g: Generation, options?: SelectOptions) => void,
  onReminder?: (title: string) => void,
) {
  const timersRef = useRef(new Map<string, SnoozeEntry>());

  const cancelSnooze = useCallback((generationId: string) => {
    const entry = timersRef.current.get(generationId);
    if (entry) {
      window.clearTimeout(entry.timeoutId);
      timersRef.current.delete(generationId);
    }
  }, []);

  const scheduleSnooze = useCallback(
    (gen: Generation, delayMs: number, title: string) => {
      cancelSnooze(gen.id);
      const timeoutId = window.setTimeout(() => {
        timersRef.current.delete(gen.id);
        select(gen, { loadEditorText: false });
        onReminder?.(title);
      }, delayMs);
      timersRef.current.set(gen.id, { timeoutId, title });
    },
    [cancelSnooze, onReminder, select],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((entry) => window.clearTimeout(entry.timeoutId));
      timers.clear();
    };
  }, []);

  return { scheduleSnooze, cancelSnooze };
}
