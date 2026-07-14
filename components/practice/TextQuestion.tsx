"use client";

export function TextQuestion({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return <input className="h-10 w-full rounded-md border border-line px-3 dark:border-slate-700 dark:bg-slate-950" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="Type your answer" />;
}
