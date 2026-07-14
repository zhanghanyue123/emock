"use client";

import { Button } from "@/components/ui/Button";
import type { AnswerValue, Question } from "@/types/test";

export function QuestionNavigator({ questions, current, answers, flagged, onSelect, onPrevious, onNext, onFlag }: {
  questions: Question[];
  current: number;
  answers: Record<string, AnswerValue>;
  flagged: string[];
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlag: () => void;
}) {
  const question = questions[current];
  return (
    <div className="rounded-lg border border-line p-3 dark:border-slate-700">
      <div className="grid grid-cols-6 gap-2">
        {questions.map((item, index) => {
          const answered = Array.isArray(answers[item.id]) ? (answers[item.id] as string[]).length > 0 : Boolean(answers[item.id]);
          const isFlagged = flagged.includes(item.id);
          return (
            <button
              key={item.id}
              className={`h-9 rounded-md border text-sm ${index === current ? "border-action bg-action text-white" : answered ? "border-blue-200 bg-blue-50 text-action dark:bg-blue-950" : "border-line"} ${isFlagged ? "ring-2 ring-amber-300" : ""}`}
              onClick={() => onSelect(index)}
              type="button"
            >
              {item.number}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button onClick={onPrevious} disabled={current === 0}>Prev</Button>
        <Button onClick={onFlag} variant={question && flagged.includes(question.id) ? "primary" : "secondary"}>Flag</Button>
        <Button onClick={onNext} disabled={current >= questions.length - 1}>Next</Button>
      </div>
    </div>
  );
}
