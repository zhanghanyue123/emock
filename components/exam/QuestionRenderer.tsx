"use client";

import { getQuestionRenderer } from "@/core/exam/exam-registry";
import type { ExamQuestion, ExamResponse } from "@/core/exam/types";
import { UnsupportedQuestion } from "./UnsupportedQuestion";

export function QuestionRenderer({ question, response, onResponse }: {
  question: ExamQuestion;
  response?: ExamResponse;
  onResponse: (response: ExamResponse) => void;
}) {
  const renderer = getQuestionRenderer(question.rendererId);
  if (!renderer) return <UnsupportedQuestion question={question} />;
  const Component = renderer.component;
  return <Component question={question} response={response} onResponse={onResponse} />;
}
