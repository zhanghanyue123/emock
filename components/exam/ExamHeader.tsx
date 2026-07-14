"use client";

import { Button } from "@/components/ui/Button";
import { formatSeconds } from "@/lib/format";

export function ExamHeader({ title, sectionTitle, questionLabel, remainingSeconds, onSubmit, pauseAllowed = false, paused = false, pauseReason, onPause, onResume, mode = "review" }: {
  title: string;
  sectionTitle: string;
  questionLabel: string;
  remainingSeconds: number;
  onSubmit: () => void;
  mode?: "exam" | "review";
  pauseAllowed?: boolean;
  paused?: boolean;
  pauseReason?: string;
  onPause?: () => void;
  onResume?: () => void;
}) {
  return (
    <div className="sticky top-14 z-20 border-b border-line bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs uppercase text-muted">{sectionTitle} · {questionLabel} · {mode === "exam" ? "Exam mode" : "Review mode"}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-line px-3 py-2 font-mono text-lg">{formatSeconds(remainingSeconds)}</div>
          {paused ? (
            <Button onClick={onResume} variant="primary">Resume</Button>
          ) : (
            <Button onClick={onPause} disabled={!pauseAllowed} title={pauseAllowed ? "Pause practice" : pauseReason || "Pause unavailable"}>Pause</Button>
          )}
          <Button onClick={onSubmit} variant="primary">Submit</Button>
        </div>
      </div>
    </div>
  );
}
