import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}>{children}</div>;
}
