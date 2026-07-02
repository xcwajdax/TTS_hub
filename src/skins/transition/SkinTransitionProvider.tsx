import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createTransitionRunner } from "./playTransition";
import type { PlaySkinTransitionOptions } from "./types";

interface SkinTransitionContextValue {
  playTransition: (options: PlaySkinTransitionOptions) => Promise<void>;
  busy: boolean;
}

const SkinTransitionContext = createContext<SkinTransitionContextValue | null>(null);

export function SkinTransitionProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const mountOverlay = useCallback((canvas: HTMLCanvasElement) => {
    document.body.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, []);

  const runnerRef = useRef<ReturnType<typeof createTransitionRunner> | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = createTransitionRunner(
      () => document.getElementById("root"),
      mountOverlay,
    );
  }

  const playTransition = useCallback(async (options: PlaySkinTransitionOptions) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await runnerRef.current!(options);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ playTransition, busy }),
    [playTransition, busy],
  );

  return (
    <SkinTransitionContext.Provider value={value}>
      {children}
    </SkinTransitionContext.Provider>
  );
}

export function useSkinTransition(): SkinTransitionContextValue {
  const ctx = useContext(SkinTransitionContext);
  if (!ctx) {
    throw new Error("useSkinTransition must be used within SkinTransitionProvider");
  }
  return ctx;
}

/** Optional hook — returns null outside provider (e.g. tests). */
export function useSkinTransitionOptional(): SkinTransitionContextValue | null {
  return useContext(SkinTransitionContext);
}
