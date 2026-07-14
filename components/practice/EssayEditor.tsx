"use client";

export function EssayEditor({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const words = (value || "").trim().split(/\s+/).filter(Boolean).length;
  return (
    <div>
      <textarea className="min-h-64 w-full rounded-md border border-line p-3 leading-7 dark:border-slate-700 dark:bg-slate-950" value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="Write your response here." />
      <div className="mt-2 text-right text-xs text-muted">{words} words</div>
    </div>
  );
}
