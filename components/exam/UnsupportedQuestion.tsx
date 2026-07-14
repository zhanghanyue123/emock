"use client";

import type { ExamQuestion } from "@/core/exam/types";

export function UnsupportedQuestion({ question }: { question: ExamQuestion }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="font-semibold">Unsupported question type</div>
      <div className="mt-2 grid gap-1">
        <span>rendererId: {question.rendererId}</span>
        <span>questionId: {question.id}</span>
        <span>examPackId: {question.examPackId}</span>
      </div>
    </div>
  );
}
