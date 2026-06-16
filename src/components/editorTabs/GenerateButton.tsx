import { useCallback, useState } from "react";
import { isTauriApp } from "../../lib/tauriEnv";

interface Props {
  enqueuing: boolean;
  canGenerate: boolean;
  hasGeneration: boolean;
  queueHint?: string;
  onGenerate: () => void | Promise<void>;
}

export default function GenerateButton({
  enqueuing,
  canGenerate,
  hasGeneration,
  queueHint,
  onGenerate,
}: Props) {
  const [hoverRegen, setHoverRegen] = useState(false);

  const handleClick = useCallback(async () => {
    if (enqueuing || !canGenerate) return;
    if (hasGeneration) return;
    await onGenerate();
  }, [enqueuing, canGenerate, hasGeneration, onGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (enqueuing || !canGenerate) return;
    const message = "Wygenerować ponownie? Poprzednia generacja pozostanie w historii.";
    const ok = isTauriApp()
      ? await import("@tauri-apps/plugin-dialog").then(({ confirm }) =>
          confirm(message, { title: "Generuj ponownie", kind: "warning" }),
        )
      : window.confirm(message);
    if (!ok) return;
    await onGenerate();
  }, [enqueuing, canGenerate, onGenerate]);

  const label = enqueuing ? "Dodawanie..." : queueHint ? `Generuj (${queueHint})` : "Generuj";
  const disabled = enqueuing || !canGenerate || (hasGeneration && !hoverRegen);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => hasGeneration && setHoverRegen(true)}
      onMouseLeave={() => setHoverRegen(false)}
    >
      <button
        type="button"
        className={`btn-primary ${hasGeneration && !hoverRegen ? "opacity-45 cursor-not-allowed" : ""}`}
        onClick={hasGeneration && hoverRegen ? () => void handleRegenerate() : () => void handleClick()}
        disabled={disabled}
        title={
          hasGeneration
            ? hoverRegen
              ? "Generuj ponownie (wymaga potwierdzenia)"
              : "Już wygenerowano — najedź, aby wygenerować ponownie"
            : queueHint
              ? `Dodaje do kolejki (${queueHint}, Ctrl+Enter)`
              : "Dodaje do kolejki (Ctrl+Enter)"
        }
      >
        {hasGeneration && hoverRegen ? "Generuj ponownie" : label}
      </button>
    </div>
  );
}
