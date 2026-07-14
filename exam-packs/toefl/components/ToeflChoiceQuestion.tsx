"use client";

import { TOEFL_RENDERERS, isToeflChoiceConfig } from "../question-types";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

export function ToeflChoiceQuestion({ question, response, onResponse }: ExamQuestionRendererProps) {
  if (!isToeflChoiceConfig(question.config)) {
    return <div className="rounded-md border border-red-300 p-3 text-sm text-red-700">Invalid TOEFL choice config.</div>;
  }
  const selected = Array.isArray((response?.value as { optionIds?: unknown })?.optionIds)
    ? ((response?.value as { optionIds: string[] }).optionIds)
    : [];
  if (question.config.options.length === 0) {
    return null;
  }
  return (
    <fieldset className="grid gap-3">
      {question.config.options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left text-sm ${active ? "border-action bg-blue-50 text-action dark:bg-blue-950" : "border-line bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"}`}
          >
            <input
              checked={active}
              className="mt-0.5 h-4 w-4"
              name={question.id}
              type="radio"
              value={option.id}
              onChange={() => onResponse({
                questionId: question.id,
                responseType: TOEFL_RENDERERS.choice,
                value: { optionIds: [option.id] },
                updatedAt: new Date().toISOString()
              })}
            />
            <span><span className="mr-2 font-semibold">{option.label || option.id}</span>{option.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
