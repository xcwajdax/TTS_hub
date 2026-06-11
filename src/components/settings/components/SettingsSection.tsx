import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  borderTop?: boolean;
  children: ReactNode;
}

export default function SettingsSection({
  title,
  description,
  borderTop = false,
  children,
}: Props) {
  return (
    <section
      className={`flex flex-col gap-3 ${borderTop ? "border-t border-border pt-5" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xs uppercase tracking-wide text-muted">{title}</h3>
        {description ? (
          <p className="text-[11px] text-muted leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
