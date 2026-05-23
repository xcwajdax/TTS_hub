import type { MinimaxClonedVoice } from "../api/tauri";
import MinimaxVoiceClone from "./MinimaxVoiceClone";

interface Props {
  open: boolean;
  onClose: () => void;
  model: string;
  onCloned: (voice: MinimaxClonedVoice) => void;
  onError: (message: string) => void;
}

export default function MinimaxVoiceCloneModal({
  open,
  onClose,
  model,
  onCloned,
  onError,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-panel border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="minimax-voice-clone-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 id="minimax-voice-clone-title" className="text-base font-semibold">
            Stwórz głos
          </h2>
          <button type="button" className="btn px-2.5" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <MinimaxVoiceClone model={model} onCloned={onCloned} onError={onError} />
        </div>
      </div>
    </div>
  );
}
