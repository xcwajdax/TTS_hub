import type { ReactNode } from "react";

interface Props {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export default function ToastWindowPanel({ title, headerRight, children, compact = false }: Props) {
  return (
    <div className="w-full flex flex-col gap-1.5 pointer-events-auto">
      <div className="rounded-lg border border-border/80 bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur-md overflow-hidden">
        <header
          className={`border-b border-border/60 bg-panel2/80 flex items-center justify-between gap-2 ${
            compact ? "px-2 py-1" : "px-2.5 py-1.5"
          }`}
        >
          <h3 className="text-[10px] uppercase tracking-wide text-muted font-medium">{title}</h3>
          {headerRight}
        </header>
        <div className={`flex flex-col gap-1.5 ${compact ? "p-2" : "p-2.5 gap-2"}`}>{children}</div>
      </div>
    </div>
  );
}
