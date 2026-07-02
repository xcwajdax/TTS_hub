import { useEffect, useState } from "react";
import {
  setMinimaxClonedVoiceOutputVol,
  type MinimaxClonedVoice,
} from "../api/tauri";
import { effectiveMinimaxVol } from "../lib/minimaxVol";
import ProfileScrubInput from "./voiceProfiles/fields/ProfileScrubInput";

interface Props {
  voiceId: string;
  presetVol: number;
  cloned: MinimaxClonedVoice[];
  onClonedUpdated: (voice: MinimaxClonedVoice) => void;
  onError?: (message: string) => void;
  className?: string;
  voiceProfileUi?: boolean;
}

export default function MinimaxCloneVolumeControl({
  voiceId,
  presetVol,
  cloned,
  onClonedUpdated,
  onError,
  className = "",
  voiceProfileUi = false,
}: Props) {
  const entry = cloned.find((v) => v.voice_id === voiceId);
  const [saving, setSaving] = useState(false);
  const savedMultiplier = entry?.output_vol ?? 1;
  const [draftMultiplier, setDraftMultiplier] = useState(savedMultiplier);

  useEffect(() => {
    setDraftMultiplier(savedMultiplier);
  }, [savedMultiplier, voiceId]);

  if (!entry) return null;

  const persist = async (next: number) => {
    if (saving) return;
    const clamped = Math.min(5, Math.max(0, next));
    setDraftMultiplier(clamped);
    setSaving(true);
    try {
      const updated = await setMinimaxClonedVoiceOutputVol(voiceId, clamped);
      onClonedUpdated(updated);
    } catch (e) {
      setDraftMultiplier(savedMultiplier);
      onError?.(String(e));
    } finally {
      setSaving(false);
    }
  };

  const labelClass = voiceProfileUi ? "vp-form__label" : "flex min-w-0 w-full flex-col gap-1 text-xs text-muted";

  return (
    <div className={`${labelClass} ${className}`.trim()}>
      <span className={voiceProfileUi ? undefined : "break-words"}>Głośność klonu ({entry.name})</span>
      {voiceProfileUi ? (
        <div className="vp-slider-field">
          <input
            type="range"
            className="vp-range"
            min={0}
            max={5}
            step={0.1}
            value={draftMultiplier}
            disabled={saving}
            onChange={(e) => setDraftMultiplier(Number(e.target.value))}
            onPointerUp={(e) => void persist(Number(e.currentTarget.value))}
            aria-label="Głośność sklonowanego głosu"
          />
          <ProfileScrubInput
            value={draftMultiplier}
            min={0}
            max={5}
            step={0.1}
            disabled={saving}
            onChange={(v) => {
              setDraftMultiplier(v);
              void persist(v);
            }}
          />
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <input
            className="field min-w-0 flex-1"
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={draftMultiplier}
            disabled={saving}
            onChange={(e) => setDraftMultiplier(Number(e.target.value))}
            onPointerUp={(e) => void persist(Number(e.currentTarget.value))}
            onKeyUp={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                void persist(Number(e.currentTarget.value));
              }
            }}
            title="Mnożnik stosowany do pola Vol powyżej"
            aria-label="Głośność sklonowanego głosu"
          />
          <span className="shrink-0 text-[10px] text-muted/80 tabular-nums">
            ×{draftMultiplier.toFixed(1)} → {effectiveMinimaxVol(presetVol, voiceId, [
              { ...entry, output_vol: draftMultiplier },
            ]).toFixed(1)}
          </span>
        </div>
      )}
      <span className={voiceProfileUi ? "vp-hint" : "text-[10px] text-muted/70 break-words"}>
        {voiceProfileUi
          ? `×${draftMultiplier.toFixed(1)} → ${effectiveMinimaxVol(presetVol, voiceId, [{ ...entry, output_vol: draftMultiplier }]).toFixed(1)} · klony bywają cichsze`
          : "Klony MiniMax bywają cichsze — podnieś mnożnik (np. 1,5–3) zamiast ponownego klonowania."}
      </span>
    </div>
  );
}
