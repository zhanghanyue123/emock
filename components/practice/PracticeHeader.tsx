"use client";

import { Button } from "@/components/ui/Button";
import { formatSeconds } from "@/lib/format";

export function PracticeHeader({ title, section, remainingSeconds, paused, onPause, onSave, onSubmit }: {
  title: string;
  section: string;
  remainingSeconds: number;
  paused: boolean;
  onPause: () => void;
  onSave: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="sticky top-14 z-20 border-b border-line bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button href="/tests" variant="ghost">Back</Button>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs uppercase text-muted">{section}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-line px-3 py-2 font-mono text-lg">{formatSeconds(remainingSeconds)}</div>
          <Button onClick={onPause}>{paused ? "Resume" : "Pause"}</Button>
          <Button onClick={onSave}>Save and exit</Button>
          <Button onClick={onSubmit} variant="primary">Submit</Button>
        </div>
      </div>
    </div>
  );
}
