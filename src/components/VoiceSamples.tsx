import { useCallback, useEffect, useState } from "react";
import { listVoiceSamples, type VoiceSampleInfo } from "../api/tauri";
import { useVoiceAvatar } from "../hooks/useAvatars";
import AvatarImage from "./avatars/AvatarImage";
import VoiceSamplePlayButton from "./VoiceSamplePlayButton";

function VoiceSampleCell({
  voice,
  selected,
  ready,
  disabled,
  model,
  onSelectVoice,
  onReady,
  onError,
}: {
  voice: string;
  selected: boolean;
  ready: boolean;
  disabled: boolean;
  model: string;
  onSelectVoice: (voice: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const avatar = useVoiceAvatar("google", voice);
  return (
    <div
      className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-panel2/60 hover:border-border/80"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <AvatarImage
        filePath={avatar?.path}
        fallbackLabel={voice}
        size={22}
        className="shrink-0"
      />
      <button
        type="button"
        className="flex-1 min-w-0 text-left truncate hover:text-accent transition-colors"
        onClick={() => onSelectVoice(voice)}
        title={`Wybierz głos ${voice}`}
        disabled={disabled}
      >
        {voice}
      </button>
      <VoiceSamplePlayButton
        model={model}
        voice={voice}
        ready={ready}
        onReady={onReady}
        onError={onError}
        disabled={disabled}
      />
    </div>
  );
}

interface Props {
  model: string;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export default function VoiceSamples({
  model,
  selectedVoice,
  onSelectVoice,
  onError,
  disabled = false,
}: Props) {
  const [samples, setSamples] = useState<VoiceSampleInfo[]>([]);

  const refresh = useCallback(() => {
    listVoiceSamples(model)
      .then(setSamples)
      .catch((e) => onError(String(e)));
  }, [model, onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const readyByVoice = new Map(samples.map((s) => [s.voice, s.ready]));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1 mt-1">
      {samples.map(({ voice }) => {
        const selected = voice === selectedVoice;
        const ready = readyByVoice.get(voice) ?? false;
        return (
          <VoiceSampleCell
            key={voice}
            voice={voice}
            selected={selected}
            ready={ready}
            disabled={disabled}
            model={model}
            onSelectVoice={onSelectVoice}
            onReady={refresh}
            onError={onError}
          />
        );
      })}
    </div>
  );
}
