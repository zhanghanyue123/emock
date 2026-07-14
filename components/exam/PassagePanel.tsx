"use client";

import type { ReactNode } from "react";
import { WordBlankInput } from "@/exam-packs/toefl/components/WordBlankInput";
import type { Passage, TestQuestion } from "@/types/structured-test";

function renderTextWithBlanks(text: string, question?: TestQuestion, answers?: Record<string, string>, onBlankChange?: (blankId: string, value: string) => void) {
  if (!question?.blanks?.length || question.type !== "complete_words") return <p className="leading-8">{text}</p>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const blank of question.blanks) {
    const prefix = blank.prefix || "";
    const suffix = blank.suffix || "";
    const target = `${prefix}${suffix}`;
    const index = text.indexOf(target, cursor);
    if (index < 0) continue;
    parts.push(text.slice(cursor, index));
    parts.push(
      <WordBlankInput
        key={blank.id}
        blank={{ id: blank.id, prefix, suffix, missingLength: blank.missingLength }}
        value={answers?.[blank.id] || ""}
        onChange={(value) => onBlankChange?.(blank.id, value)}
      />
    );
    cursor = index + target.length;
  }
  parts.push(text.slice(cursor));
  return <p className="leading-8">{parts}</p>;
}

export function PassagePanel({ passage, activeQuestion, blankAnswers, onBlankChange }: {
  passage?: Passage;
  activeQuestion?: TestQuestion;
  blankAnswers?: Record<string, string>;
  onBlankChange?: (blankId: string, value: string) => void;
}) {
  if (!passage) return <section className="h-full overflow-auto border-r border-line bg-white dark:border-slate-700 dark:bg-slate-900" />;
  return (
    <section className="h-full overflow-auto border-r border-line bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-semibold">{passage.title || "Passage"}</h2>
      <div className="grid gap-4 text-base">
        {passage.paragraphs.map((paragraph) => (
          <div key={paragraph.id}>{renderTextWithBlanks(paragraph.text, activeQuestion, blankAnswers, onBlankChange)}</div>
        ))}
      </div>
    </section>
  );
}
