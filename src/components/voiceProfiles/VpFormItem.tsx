import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  full?: boolean;
  className?: string;
}

export default function VpFormItem({ children, full, className = "" }: Props) {
  return (
    <div className={`vp-form__item${full ? " vp-form__item--full" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
