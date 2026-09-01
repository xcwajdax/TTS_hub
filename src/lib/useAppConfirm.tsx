import { useCallback, useRef, useState } from "react";
import AppConfirmDialog from "../components/AppConfirmDialog";

export interface AppConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends AppConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** Promise-based in-app confirm (replaces native Tauri / window.confirm). */
export function useAppConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((opts: AppConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const next: PendingConfirm = { ...opts, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    const cur = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    cur?.resolve(ok);
  }, []);

  const dialog = pending ? (
    <AppConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}
