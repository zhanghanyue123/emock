"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 text-sm text-muted dark:text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end"><Button onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}
