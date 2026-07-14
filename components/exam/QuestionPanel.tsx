"use client";

import "@/exam-packs/toefl";
import { QuestionRenderer } from "./QuestionRenderer";
import { SegmentAudioPlayer } from "./SegmentAudioPlayer";
import { publicAssetPath } from "@/lib/assets";
import { answerValueToExamResponse, examResponseToAnswerValue, structuredQuestionToExamQuestion } from "@/lib/toefl-structured-adapter";
import type { AnswerValue } from "@/types/test";
import type { AudioGroup, TestAssetRecord, TestQuestion } from "@/types/structured-test";
import type { PracticeRunMode } from "@/types/practice";

export function StructuredQuestionPanel({ question, groupedQuestions, answer, groupedAnswers, displayLabel, onAnswer, testId, assets, audioGroups, mode, onAutoAdvance }: {
  question: TestQuestion;
  groupedQuestions?: TestQuestion[];
  answer?: AnswerValue;
  groupedAnswers?: Record<string, AnswerValue>;
  displayLabel?: string;
  onAnswer: (value: AnswerValue) => void;
  testId?: string;
  assets?: TestAssetRecord[];
  audioGroups?: AudioGroup[];
  mode?: PracticeRunMode;
  onAutoAdvance?: () => void;
}) {
  const group = groupedQuestions?.length ? groupedQuestions : [question];
  const isCompleteWordsGroup = question.type === "complete_words" && group.length > 1;
  const isInlineBuildSentence = question.type === "build_sentence";
  const buildSentenceAnswer = Array.isArray(answer) ? answer.map(String).filter(Boolean) : [];
  const buildSentenceTotal = question.wordBank?.length || 0;
  const audioGroup = audioGroups?.find((group) => group.id === question.audioGroupId);
  const audioAsset = assets?.find((asset) => asset.id === audioGroup?.audioAssetId);
  const audioSrc = testId && audioAsset ? publicAssetPath(testId, audioAsset.file) : null;
  const examQuestion = structuredQuestionToExamQuestion(question);
  if (question.type === "listen_repeat" || question.type === "interview_response") {
    examQuestion.config = {
      ...examQuestion.config,
      originalAudioSrc: audioSrc,
      practiceRunMode: mode,
      attemptId: testId ? `${testId}:${question.section}:${question.id}` : question.id
    };
  }
  const needsChoiceExtraction = ["single_choice", "multiple_choice", "listen_choose_response", "listening_group_question"].includes(question.type);
  const hasOptions = Boolean(question.options?.length);
  const isGenericReadingPrompt = question.section === "reading" && /^(Read the material and answer the question\.|Read the academic passage and answer the question\.|Choose the best answer\.|Question \d+)$/i.test(question.prompt || "");
  const isSourceQuestionReady = question.readiness === "source_question_ready" || question.displayMode === "source_question_ready" || Boolean(needsChoiceExtraction && question.needsReview && question.questionImageAssetId && !hasOptions);
  const isMissingQuestionData = question.readiness === "missing_question_data" || Boolean(needsChoiceExtraction && question.needsReview && !hasOptions && !question.questionImageAssetId);
  const questionImageAsset = assets?.find((asset) => asset.id === question.questionImageAssetId);
  const questionImageSrc = testId && questionImageAsset ? publicAssetPath(testId, questionImageAsset.file) : null;
  const isFallback = isSourceQuestionReady || isMissingQuestionData || question.displayMode === "source_image_fallback" || Boolean(needsChoiceExtraction && question.needsReview && question.imageAssetId);
  const promptText = question.prompt && !/^Listening question \d+$/i.test(question.prompt) && !(isSourceQuestionReady && isGenericReadingPrompt) ? question.prompt : "";
  const showInstructions = question.instructions && question.instructions !== promptText && !["single_choice", "multiple_choice", "listen_choose_response", "listening_group_question"].includes(question.type);
  return (
    <section className="h-full overflow-auto bg-panel p-6 dark:bg-slate-950">
      <div className="rounded-lg border border-line bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-medium uppercase text-muted">{displayLabel || `Question ${question.number}`}</p>
        {promptText ? <h2 className="mt-2 text-lg font-semibold">{promptText}</h2> : null}
        {showInstructions && !isFallback ? <p className="mt-2 text-sm text-muted">{question.instructions}</p> : null}
        {audioSrc ? <SegmentAudioPlayer src={audioSrc} startSeconds={audioGroup?.startSeconds || 0} endSeconds={audioGroup?.endSeconds} title={audioGroup?.needsReview ? "Audio segment needs review" : "Audio"} /> : null}
        {isInlineBuildSentence ? (
          <div className="mt-5 grid gap-4">
            <div className="rounded-md border border-line bg-panel p-4 text-sm dark:border-slate-700 dark:bg-slate-950">
              <p className="font-medium">Complete the sentence in the question area.</p>
              <p className="mt-2 text-muted">{buildSentenceAnswer.length} / {buildSentenceTotal} words placed</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => onAnswer([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => onAnswer([])}
              >
                Reset
              </button>
            </div>
          </div>
        ) : isCompleteWordsGroup ? (
          <div className="mt-5 rounded-md border border-line bg-panel p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            <p className="font-medium">Fill in the missing letters in the paragraph.</p>
            <p className="mt-2 text-muted">
              {group.filter((item) => {
                const blankId = item.blanks?.[0]?.id;
                const value = blankId && groupedAnswers?.[item.id] && typeof groupedAnswers[item.id] === "object" && !Array.isArray(groupedAnswers[item.id])
                  ? (groupedAnswers[item.id] as Record<string, string>)[blankId]
                  : "";
                return String(value || "").length >= (item.blanks?.[0]?.missingLength || 1);
              }).length} / {group.length} blanks completed
            </p>
          </div>
        ) : isSourceQuestionReady && questionImageSrc ? (
          <div className="mt-5 overflow-auto rounded-md border border-line bg-panel p-3 dark:border-slate-700 dark:bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={questionImageSrc} alt={`${displayLabel || `Question ${question.number}`} source question`} className="mx-auto block h-auto max-w-full object-contain object-top" />
          </div>
        ) : isMissingQuestionData || (isFallback && needsChoiceExtraction && !hasOptions) ? (
          <div className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
            Missing question data for this Reading item. The source question image or structured options must be linked before this can be used as a formal question.
          </div>
        ) : (
          <div className="mt-5">
            <QuestionRenderer
              question={examQuestion}
              response={answerValueToExamResponse(question, answer)}
              onResponse={(response) => {
                onAnswer(examResponseToAnswerValue(response));
                if (mode === "exam" && (question.type === "listen_repeat" || question.type === "interview_response")) {
                  window.setTimeout(() => onAutoAdvance?.(), 700);
                }
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
