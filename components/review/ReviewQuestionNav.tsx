"use client";

import { RESULT_STATUS_STYLES } from "@/lib/result-styles";
import type { QuestionResult } from "@/types/practice";

export function ReviewQuestionNav({ results, flaggedQuestions, activeId, onSelect }: {
  results: QuestionResult[];
  flaggedQuestions: string[];
  activeId?: string;
  onSelect?: (questionId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 text-xs font-semibold uppercase text-muted">Questions</div>
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
        {results.map((result) => {
          const style = RESULT_STATUS_STYLES[result.status];
          const active = activeId === result.questionId;
          const flagged = flaggedQuestions.includes(result.questionId);
          return (
            <button
              key={result.questionId}
              type="button"
              className={`relative h-9 rounded-md border text-sm font-medium ${style.nav} ${active ? "ring-2 ring-action ring-offset-2 dark:ring-offset-slate-950" : ""}`}
              onClick={() => {
                onSelect?.(result.questionId);
                document.getElementById(`review-${result.questionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              aria-label={`Question ${result.questionNumber}: ${style.label}${flagged ? ", flagged" : ""}`}
            >
              {result.questionNumber}
              {flagged ? <span className="absolute -right-1 -top-1 rounded-sm bg-amber-200 px-1 text-[9px] text-amber-900" aria-hidden="true">F</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
