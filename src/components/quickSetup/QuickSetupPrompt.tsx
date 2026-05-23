import { useState } from "react";
import { openQuickSetupWindow } from "../../api/tauri";
import { isTauriApp } from "../../lib/tauriEnv";
import QuickSetupWizard from "./QuickSetupWizard";

interface Props {
  onDismiss: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

export default function QuickSetupPrompt({ onDismiss, onSaved, onError }: Props) {
  const [inlineOpen, setInlineOpen] = useState(false);

  const startWindow = async () => {
    if (!isTauriApp()) {
      setInlineOpen(true);
      return;
    }
    try {
      await openQuickSetupWindow();
      onDismiss();
    } catch (e) {
      onError(String(e));
      setInlineOpen(true);
    }
  };

  if (inlineOpen) {
    return (
      <QuickSetupWizard
        mode="overlay"
        onClose={() => {
          setInlineOpen(false);
          onDismiss();
        }}
        onSaved={() => {
          setInlineOpen(false);
          onSaved();
        }}
        onError={onError}
      />
    );
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-lg border border-accent2/40 bg-panel shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-sm flex-1">
        <span className="font-medium">Szybka konfiguracja</span> — dodaj providery TTS i przetestuj
        połączenia.
      </p>
      <div className="flex gap-2 shrink-0">
        <button type="button" className="btn-primary text-xs" onClick={() => void startWindow()}>
          Rozpocznij
        </button>
        <button type="button" className="btn text-xs" onClick={onDismiss}>
          Później
        </button>
      </div>
    </div>
  );
}
