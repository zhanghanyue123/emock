"use client";

import type { AnswerValue, Question } from "@/types/test";

export function ChoiceQuestion({ question, value, onChange }: { question: Question; value?: AnswerValue; onChange: (value: AnswerValue) => void }) {
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];
  const multiple = question.type === "multiple_choice";
  return (
    <div className="grid gap-2">
      {(question.options || ["A", "B", "C", "D"]).map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`rounded-md border p-3 text-left text-sm ${active ? "border-action bg-blue-50 text-action dark:bg-blue-950" : "border-line hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}
            onClick={() => {
              if (!multiple) onChange(option);
              else {
                const next = active ? selected.filter((item) => item !== option) : [...selected, option];
                onChange(question.maxSelections ? next.slice(0, question.maxSelections) : next);
              }
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
