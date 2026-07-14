"use client";

import { isToeflChoiceConfig } from "../question-types";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

export function ListeningChoiceQuestion({ question, response, onResponse }: ExamQuestionRendererProps) {
  if (!isToeflChoiceConfig(question.config) || question.config.options.length === 0) {
    return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Options are missing for this listening question.</p>;
  }

  const selectedOptionId = Array.isArray((response?.value as { optionIds?: unknown })?.optionIds)
    ? String((response?.value as { optionIds: unknown[] }).optionIds[0] || "")
    : "";

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{question.prompt?.type === "plain_text" ? question.prompt.text : "Choose the best response"}</legend>
      {question.config.options.map((option) => {
        const active = selectedOptionId === option.id;
        return (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left text-sm transition ${active ? "border-action bg-blue-50 text-action dark:bg-blue-950" : "border-line bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"}`}
          >
            <input
              checked={active}
              className="mt-0.5 h-4 w-4"
              name={question.id}
              type="radio"
              value={option.id}
              onChange={() => onResponse({
                questionId: question.id,
                responseType: "choice",
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
