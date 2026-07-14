"use client";

import { EssayEditor } from "./EssayEditor";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { SpeakingPlaceholder } from "./SpeakingPlaceholder";
import { TextQuestion } from "./TextQuestion";
import type { AnswerValue, Question } from "@/types/test";

export function QuestionPanel({ question, answer, note, disabled, onAnswer, onNote }: {
  question?: Question;
  answer?: AnswerValue;
  note?: string;
  disabled?: boolean;
  onAnswer: (value: AnswerValue) => void;
  onNote: (value: string) => void;
}) {
  if (!question) return <div className="rounded-lg border border-line p-4 text-sm text-muted">No questions configured for this section.</div>;
  return (
    <div className="rounded-lg border border-line p-4 dark:border-slate-700">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase text-muted">Question {question.number}</p>
        <h2 className="mt-1 text-base font-semibold">{question.prompt || "Answer according to the PDF."}</h2>
        {question.page ? <p className="mt-1 text-xs text-muted">PDF page: {question.page}</p> : null}
      </div>
      {disabled ? <p className="mb-3 rounded-md border border-line bg-panel p-2 text-sm text-muted dark:border-slate-700 dark:bg-slate-950">Submitted attempts are locked.</p> : null}
      {question.type === "single_choice" || question.type === "multiple_choice" ? <ChoiceQuestion question={question} value={answer} onChange={disabled ? () => undefined : onAnswer} /> : null}
      {question.type === "text" ? <TextQuestion value={typeof answer === "string" ? answer : ""} onChange={disabled ? () => undefined : onAnswer} /> : null}
      {question.type === "essay" ? <EssayEditor value={typeof answer === "string" ? answer : ""} onChange={disabled ? () => undefined : onAnswer} /> : null}
      {question.type === "speaking_placeholder" ? <SpeakingPlaceholder /> : null}
      <label className="mt-4 block text-sm">
        <span className="text-muted">Note</span>
        <textarea disabled={disabled} className="mt-1 min-h-24 w-full rounded-md border border-line p-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950" value={note || ""} onChange={(event) => onNote(event.target.value)} />
      </label>
    </div>
  );
}
