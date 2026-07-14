"use client";

import { isToeflCompleteWordsConfig } from "../question-types";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

export function ToeflCompleteWordsQuestion({ question }: ExamQuestionRendererProps) {
  if (!isToeflCompleteWordsConfig(question.config)) {
    return <div className="rounded-md border border-red-300 p-3 text-sm text-red-700">Invalid TOEFL complete-words config.</div>;
  }
  return (
    <div className="grid gap-3 rounded-md border border-line bg-panel p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
      <p className="text-muted">Complete the missing letters in the passage.</p>
      {question.config.blanks.length ? (
        <div className="text-xs text-muted">
          {question.config.blanks.map((blank) => (
            <div key={blank.id}>Use the character cells after <span className="font-medium">{blank.prefix}</span> in the passage.</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
