"use client";

import type { QuestionOption } from "@/types/structured-test";

export function OptionList({ options, value, onChange }: { options: QuestionOption[]; value?: string; onChange: (optionId: string) => void }) {
  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`rounded-md border p-3 text-left text-sm ${value === option.id ? "border-action bg-blue-50 text-action dark:bg-blue-950" : "border-line bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"}`}
          onClick={() => onChange(option.id)}
        >
          <span className="mr-2 font-semibold">{option.label || option.id}</span>
          {option.text}
        </button>
      ))}
    </div>
  );
}
