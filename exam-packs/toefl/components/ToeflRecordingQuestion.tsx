 "use client";

import { TOEFL_RENDERERS } from "../question-types";
import { SpeakingRecorder } from "@/components/exam/SpeakingRecorder";
import type { ExamQuestionRendererProps } from "@/core/exam/types";

export function ToeflRecordingQuestion({ question, response, onResponse }: ExamQuestionRendererProps) {
  const responseSeconds = typeof question.config.responseSeconds === "number" ? question.config.responseSeconds : undefined;
  const mode = question.config.practiceRunMode === "exam" ? "full_mock" : "practice";

  return (
    <div className="grid gap-3">
      {typeof question.config.context === "string" && question.config.context ? <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-950">{question.config.context}</p> : null}
      <SpeakingRecorder
        attemptId={String(question.config.attemptId || `${question.sectionId}:${question.moduleId || ""}`)}
        examId={question.examPackId}
        sectionId={question.sectionId}
        questionId={question.id}
        value={response?.value}
        mode={mode}
        responseSeconds={responseSeconds}
        originalAudioSrc={typeof question.config.originalAudioSrc === "string" ? question.config.originalAudioSrc : null}
        onChange={(value) => onResponse({
          questionId: question.id,
          responseType: TOEFL_RENDERERS.recording,
          value,
          updatedAt: new Date().toISOString()
        })}
      />
    </div>
  );
}
