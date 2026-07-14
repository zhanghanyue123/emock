"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { AddVocabularyButton } from "@/components/vocabulary/AddVocabularyButton";
import { TextSelectionVocabularyAction } from "@/components/vocabulary/TextSelectionVocabularyAction";
import { answerToText } from "@/lib/format";
import { RESULT_STATUS_STYLES } from "@/lib/result-styles";
import { ResultStatusBadge } from "@/components/review/ResultStatusBadge";
import type { QuestionResult, VocabularySource } from "@/types/practice";
import type { SpeakingRecordingAnswer } from "@/types/practice";
import type { AnswerValue, Question } from "@/types/test";
import type { SentenceToken } from "@/types/structured-test";

interface CompleteWordsReviewConfig {
  blanks?: {
    id: string;
    prefix?: string;
    suffix?: string;
    missingLength?: number;
  }[];
}

type ReviewQuestionShape = Omit<Question, "type"> & { type?: Question["type"] | "build_sentence"; completeWords?: CompleteWordsReviewConfig };
type BuildSentenceReviewShape = ReviewQuestionShape & {
  type?: string;
  wordBank?: (string | SentenceToken)[];
  fixedPrefix?: string;
  fixedSuffix?: string;
  options?: (string | { id: string; label?: string; text: string })[];
};

function normalizedOption(option: string | { id: string; label?: string; text: string }) {
  return typeof option === "string" ? { id: option, label: option, text: option } : option;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
}

function answerHas(value: unknown, option: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const answer = value as { optionId?: unknown; optionIds?: unknown[] };
    if (typeof answer.optionId === "string") return answer.optionId === option;
    if (Array.isArray(answer.optionIds)) return answer.optionIds.map(String).includes(option);
  }
  return asArray(value).includes(option);
}

function optionLabel({ optionId, userAnswer, correctAnswer, reveal }: { optionId: string; userAnswer: unknown; correctAnswer: unknown; reveal: boolean }) {
  const selected = answerHas(userAnswer, optionId);
  const correct = answerHas(correctAnswer, optionId);
  const labels: string[] = [];
  if (selected) labels.push("Your answer");
  if (reveal && correct) labels.push("Correct answer");
  if (reveal && selected && !correct) labels.push("Incorrect extra option");
  if (reveal && !selected && correct) labels.push("Missed correct option");
  return labels.join(" · ");
}

function buildSentenceText(question: BuildSentenceReviewShape, value: unknown) {
  const tokenById = new Map(
    (question.wordBank || [])
      .map((token, index) => typeof token === "string" ? { id: token, text: token, order: index + 1 } : token)
      .map((token) => [token.id, token.text])
  );
  const tokenIds = Array.isArray(value)
    ? value.map(String)
    : value && typeof value === "object" && Array.isArray((value as { tokens?: unknown }).tokens)
      ? (value as { tokens: unknown[] }).tokens.map(String)
      : [];
  const text = [
    question.fixedPrefix || "",
    ...tokenIds.map((tokenId) => tokenById.get(tokenId) || tokenId),
    question.fixedSuffix || ""
  ].filter(Boolean).join(" ");
  return text.replace(/\s+([.,!?;:])/g, "$1").replace(/\s+/g, " ").trim() || "Not answered";
}

function speakingAnswer(value: unknown, questionId: string): SpeakingRecordingAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answer = value as Partial<SpeakingRecordingAnswer>;
  const takes = answer.recordingsByQuestionId?.[questionId];
  if (!Array.isArray(takes) || takes.length === 0) return null;
  return { recordingsByQuestionId: answer.recordingsByQuestionId || {}, selectedRecordingId: answer.selectedRecordingId };
}

function recordingSrc(recording: { dataUrl?: string; blobUrl?: string }) {
  return recording.dataUrl || recording.blobUrl || "";
}

export function ReviewQuestion({ question, result, note, flagged, reveal, onToggleReveal, inMistakes, onToggleMistake, vocabularySource, sourceCandidates }: {
  question: BuildSentenceReviewShape;
  result: QuestionResult;
  note?: string;
  flagged: boolean;
  reveal: boolean;
  onToggleReveal: () => void;
  inMistakes: boolean;
  onToggleMistake: () => void;
  vocabularySource?: VocabularySource;
  sourceCandidates?: { label: string; text: string }[];
}) {
  const style = RESULT_STATUS_STYLES[result.status];
  const options = useMemo(() => (question.options || (question.type === "single_choice" || question.type === "multiple_choice" ? ["A", "B", "C", "D"] : [])).map(normalizedOption), [question]);
  const completeWords = question.completeWords?.blanks || [];
  const isBuildSentence = String(question.type) === "build_sentence" || Boolean(question.wordBank?.length && Array.isArray(result.correctAnswer));
  const speaking = speakingAnswer(result.userAnswer, question.id);
  return (
    <div id={`review-${question.id}`} className={`scroll-mt-24 rounded-lg border p-4 ${style.card}`}>
      {vocabularySource ? <TextSelectionVocabularyAction source={vocabularySource} /> : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted">Question {question.number}</p>
          <h3 className="mt-1 font-semibold">{question.prompt || question.id}</h3>
        </div>
        <ResultStatusBadge status={result.status} />
      </div>
      {completeWords.length > 0 ? (
        <div className="mt-3 grid gap-3 text-sm">
          {completeWords.map((blank) => {
            const userValues = result.userAnswer && typeof result.userAnswer === "object" && !Array.isArray(result.userAnswer) ? result.userAnswer as Record<string, string> : {};
            const correctValues = result.correctAnswer && typeof result.correctAnswer === "object" && !Array.isArray(result.correctAnswer) ? result.correctAnswer as Record<string, string> : {};
            const user = String(userValues[blank.id] || "");
            const correct = String(correctValues[blank.id] || "");
            const length = Math.max(1, blank.missingLength || correct.length || user.length);
            return (
              <div key={blank.id} className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Your answer:</span>
                <span>{blank.prefix}</span>
                <span className="inline-flex gap-1">
                  {Array.from({ length }, (_, index) => {
                    const userChar = user[index] || "";
                    const correctChar = correct[index] || "";
                    const isCorrect = userChar.toLowerCase() === correctChar.toLowerCase() && userChar.length > 0;
                    const cellClass = reveal
                      ? isCorrect
                        ? "border-green-400 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-100"
                        : "border-red-400 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
                      : "border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-950";
                    return <span key={`${blank.id}-${index}`} className={`inline-flex h-8 w-7 items-center justify-center rounded border text-base font-semibold ${cellClass}`}>{userChar || " "}</span>;
                  })}
                </span>
                {blank.suffix ? <span>{blank.suffix}</span> : null}
                {reveal ? <span className="ml-2 text-muted">Correct: {correct}</span> : null}
              </div>
            );
          })}
        </div>
      ) : speaking ? (
        <div className="mt-3 grid gap-3 text-sm">
          {(speaking.recordingsByQuestionId[question.id] || []).map((recording) => (
            <div key={recording.id} className={`rounded-md border p-3 ${recording.id === speaking.selectedRecordingId ? "border-action bg-blue-50 dark:bg-blue-950" : "border-line bg-white/70 dark:border-slate-700 dark:bg-slate-950/60"}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Take {recording.takeNumber}{recording.id === speaking.selectedRecordingId ? " · selected" : ""}</span>
                <span className="text-xs text-muted">{Math.round(recording.durationMs / 1000)}s · {new Date(recording.createdAt).toLocaleString()}</span>
              </div>
              {recordingSrc(recording) ? <audio controls src={recordingSrc(recording)} className="w-full" /> : <p className="text-muted">Recording audio is unavailable on this device.</p>}
            </div>
          ))}
        </div>
      ) : isBuildSentence ? (
        <div className="mt-3 grid gap-2 rounded-md border border-line bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/60 md:grid-cols-2">
          <p><span className="text-muted">Your answer:</span> {buildSentenceText(question, result.userAnswer)}</p>
          {reveal ? <p><span className="text-muted">Correct answer:</span> {buildSentenceText(question, result.correctAnswer)}</p> : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p><span className="text-muted">Your answer:</span> {answerToText(result.userAnswer as AnswerValue | undefined)}</p>
          {reveal ? <p><span className="text-muted">Correct answer:</span> {answerToText(result.correctAnswer as AnswerValue | undefined)}</p> : null}
        </div>
      )}
      {options.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {options.map((option) => {
            const label = optionLabel({ optionId: option.id, userAnswer: result.userAnswer, correctAnswer: result.correctAnswer, reveal });
            const selected = answerHas(result.userAnswer, option.id);
            const correct = answerHas(result.correctAnswer, option.id);
            const optionClass = reveal && correct
              ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-100"
              : selected && result.status === "incorrect"
                ? "border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
                : selected
                  ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
                  : "border-line bg-white/70 dark:border-slate-700 dark:bg-slate-950/60";
            return (
              <div key={option.id} className={`rounded-md border px-3 py-2 text-sm ${optionClass}`}>
                <span className="font-medium">{option.label || option.id}</span>
                <span className="ml-2">{option.text}</span>
                {label ? <span className="ml-2 text-xs">{label}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {reveal ? <p className="mt-3 text-sm text-muted">{question.explanation || "No explanation is available for this question."}</p> : null}
      {note ? <p className="mt-2 rounded-md bg-panel p-2 text-sm dark:bg-slate-950">Note: {note}</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">{flagged ? "Flagged" : "Not flagged"}</span>
        <div className="flex gap-2">
          <AddVocabularyButton
            prominent={result.status === "incorrect"}
            source={vocabularySource}
            sourceCandidates={sourceCandidates}
            label="Add vocabulary"
          />
          <Button onClick={onToggleReveal}>{reveal ? "Hide answer" : "Reveal answer"}</Button>
          <Button onClick={onToggleMistake} variant={inMistakes ? "danger" : result.status === "incorrect" ? "primary" : "secondary"}>{inMistakes ? "Remove from mistakes" : "Add to mistakes"}</Button>
        </div>
      </div>
    </div>
  );
}
