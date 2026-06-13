import { useEffect, useMemo, useState } from "react";
import { getAppSettings } from "../api/tauri";
import type { TtsVoiceProfile } from "../appSettings";
import type { ArchiveFolder, Generation } from "../types";
import { VOICE_PROFILES_CHANGED } from "../lib/voiceProfilesEvents";
import { groupGenerationsByCalendarDay } from "../lib/historyDateGroups";
import GenerationQueuePanel from "./GenerationQueuePanel";
import HistoryQuickItem from "./HistoryQuickItem";

interface Props {
  items: Generation[];
  folders: ArchiveFolder[];
  interrupted: Generation[];
  currentId: string | null;
  onSelect: (g: Generation) => void;
  onPlay?: (g: Generation) => void;
  onChanged: () => void;
  onError: (e: string) => void;
  voiceProfiles?: TtsVoiceProfile[];
}

export default function HistoryQuickPanel({
  items,
  folders,
  interrupted,
  currentId,
  onSelect,
  onPlay,
  onChanged,
  onError,
  voiceProfiles: voiceProfilesProp,
}: Props) {
  const [voiceProfilesState, setVoiceProfilesState] = useState<TtsVoiceProfile[]>(
    () => voiceProfilesProp ?? [],
  );
  const voiceProfiles = voiceProfilesProp ?? voiceProfilesState;

  useEffect(() => {
    if (voiceProfilesProp) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const view = await getAppSettings();
        if (!cancelled) {
          setVoiceProfilesState(view.voice_profiles ?? []);
        }
      } catch {
        // ignore
      }
    };
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(VOICE_PROFILES_CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_PROFILES_CHANGED, onChange);
    };
  }, [voiceProfilesProp]);

  const dayGroups = useMemo(() => groupGenerationsByCalendarDay(items), [items]);

  return (
    <div
      className="history-quick-panel flex flex-col h-full min-w-0 overflow-hidden bg-panel"
      data-tour="history-panel"
    >
      <div data-tour="queue">
        <GenerationQueuePanel
          interrupted={interrupted}
          onChanged={onChanged}
          onError={onError}
          voiceProfiles={voiceProfiles}
        />
      </div>

      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <h2 className="text-[10px] uppercase tracking-wide text-muted font-semibold">
          Ostatnie generacje
        </h2>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto py-1.5 px-0 history-list history-list--compact gap-0">
        {dayGroups.length === 0 ? (
          <p className="p-3 text-xs text-muted text-center">
            Brak generacji. Wygeneruj coś po lewej lub sprawdź zakładkę Historia.
          </p>
        ) : (
          dayGroups.map((group) => (
            <section
              key={group.dayKey}
              className="flex flex-col min-w-0 history-list__section gap-0.5"
            >
              <h3 className="history-list__heading">{group.label}</h3>
              {group.items.map((gen) => (
                <HistoryQuickItem
                  key={gen.id}
                  gen={gen}
                  folders={folders}
                  isCurrent={currentId === gen.id}
                  onSelect={onSelect}
                  onPlay={onPlay}
                  onChanged={onChanged}
                  onError={onError}
                  voiceProfiles={voiceProfiles}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
