import { useCallback, useState } from "react";
import ConfirmPrivateShareDialog from "../components/ConfirmPrivateShareDialog";
import { needsPrivateShareConfirm } from "./privacyMode";
import type { Generation } from "../types";

interface PendingShare {
  label: string;
  run: () => void | Promise<void>;
}

export function usePrivateShareConfirm() {
  const [pending, setPending] = useState<PendingShare | null>(null);

  const requestShare = useCallback(
    (gen: Generation | null | undefined, mediaLabel: string, run: () => void | Promise<void>) => {
      if (needsPrivateShareConfirm(gen)) {
        setPending({ label: mediaLabel, run });
        return;
      }
      void run();
    },
    [],
  );

  const dialog = pending ? (
    <ConfirmPrivateShareDialog
      mediaLabel={pending.label}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const action = pending.run;
        setPending(null);
        void action();
      }}
    />
  ) : null;

  return { requestShare, dialog };
}
