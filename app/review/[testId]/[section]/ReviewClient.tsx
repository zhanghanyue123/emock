"use client";

import { useEffect, useMemo, useState } from "react";
import { AnswerVisibilityToggle } from "@/components/review/AnswerVisibilityToggle";
import { ReviewFilters, type ReviewFilter } from "@/components/review/ReviewFilters";
import { ReviewQuestion } from "@/components/review/ReviewQuestion";
import { ReviewQuestionNav } from "@/components/review/ReviewQuestionNav";
import { ReviewSummary } from "@/components/review/ReviewSummary";
import { AiScoringPanel } from "@/components/scoring/AiScoringPanel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionKey } from "@/hooks/usePracticeSession";
import { publicAssetPath } from "@/lib/assets";
import { LocalStorageMistakeRepository } from "@/lib/repositories/mistake-repository";
import { scoreAttempt } from "@/lib/scoring";
import { storage } from "@/lib/storage";
import type { AttemptHistoryItem, AttemptScore, MistakeItem, PracticeSession, QuestionResult } from "@/types/practice";
import type { AnswerValue, SectionKey, TestManifest } from "@/types/test";
import type { StructuredTestBundle, TestQuestion } from "@/types/structured-test";

function ReviewMaterials({ test }: { test: TestManifest }) {
  const materials = test.reviewMaterials || [];
  if (!materials.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">复盘资料</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {materials.map((item) => <Button key={item.id} href={publicAssetPath(test.id, item.file) || "#"} target="_blank">{item.title}</Button>)}
      </div>
    </div>
  );
}

interface ReviewSnapshot {
  answers: AttemptHistoryItem["answers"];
  score: AttemptScore;
  flaggedQuestions: string[];
  notes: Record<string, string>;
  submittedAt?: string;
  startedAt: string;
  durationSeconds: number;
}

function hasAttemptScore(value: unknown): value is AttemptHistoryItem {
  return Boolean(value && typeof value === "object" && "score" in value && "answers" in value);
}

function structuredCorrectAnswer(question: TestQuestion): AnswerValue | undefined {
  if (question.correctAnswer?.type === "single_choice") return question.correctAnswer.optionId;
  if (question.correctAnswer?.type === "multiple_choice") return question.correctAnswer.optionIds;
  if (question.correctAnswer?.type === "complete_words") return question.correctAnswer.values;
  if (question.correctAnswer?.type === "build_sentence") return question.correctAnswer.tokens;
  if (question.correctAnswer?.type === "sentence_insertion") return question.correctAnswer.locationId;
  return undefined;
}

function mapStructuredQuestion(question: TestQuestion) {
  return {
    id: question.id,
    number: question.number,
    type: question.type === "multiple_choice" ? "multiple_choice" : question.type === "single_choice" ? "single_choice" : question.type === "build_sentence" ? "build_sentence" : "text",
    prompt: question.prompt || question.instructions,
    options: question.options?.map((option) => option.id),
    wordBank: question.wordBank,
    fixedPrefix: question.fixedPrefix,
    fixedSuffix: question.fixedSuffix,
    correctAnswer: structuredCorrectAnswer(question),
    explanation: question.explanation,
    page: question.sourcePage,
    completeWords: question.type === "complete_words" ? { blanks: question.blanks } : undefined
  } as const;
}

export function ReviewClient({ test, sectionKey, structuredBundle }: { test: TestManifest; sectionKey: SectionKey; structuredBundle?: StructuredTestBundle }) {
  const section = test.sections[sectionKey];
  const structuredSection = structuredBundle?.test.sections.find((item) => item.key === sectionKey);
  const reviewQuestions = structuredSection
    ? structuredSection.modules.flatMap((module) => module.questions).map((question) => mapStructuredQuestion(question))
    : section.questions;
  const structuredQuestions = structuredSection?.modules.flatMap((module) => module.questions) || [];
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [mistakeIds, setMistakeIds] = useState<Set<string>>(new Set());
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [answerOverrides, setAnswerOverrides] = useState<Record<string, boolean>>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | undefined>();
  const mistakeRepository = useMemo(() => new LocalStorageMistakeRepository(), []);

  useEffect(() => {
    const historyItem = storage.getHistory().find((entry) => entry.testId === test.id && entry.section === sectionKey && hasAttemptScore(entry));
    if (historyItem && hasAttemptScore(historyItem)) {
      setSnapshot({
        answers: historyItem.answers,
        score: historyItem.score,
        flaggedQuestions: historyItem.flaggedQuestions || [],
        notes: historyItem.notes || {},
        submittedAt: historyItem.submittedAt,
        startedAt: historyItem.startedAt,
        durationSeconds: historyItem.durationSeconds || historyItem.secondsSpent || 0
      });
      return;
    }

    const session = storage.getSession(sessionKey(test.id, sectionKey)) as PracticeSession | undefined;
    if (session?.status === "submitted") {
      const score = session.score || scoreAttempt(section.questions, session.answers);
      setSnapshot({
        answers: session.answers,
        score,
        flaggedQuestions: session.flaggedQuestions || [],
        notes: session.notes || {},
        submittedAt: session.submittedAt,
        startedAt: session.startedAt,
        durationSeconds: Math.max(0, section.durationMinutes * 60 - session.remainingSeconds)
      });
      return;
    }

    setSnapshot(null);
  }, [section.durationMinutes, section.questions, sectionKey, test.id]);

  useEffect(() => {
    void mistakeRepository.getMistakes().then((items) => {
      setMistakeIds(new Set(items.map((item) => item.id)));
    });
  }, [mistakeRepository]);

  const resultByQuestion = useMemo(() => new Map((snapshot?.score.questionResults || []).map((result) => [result.questionId, result])), [snapshot]);
  const questions = reviewQuestions.filter((question) => {
    const result = resultByQuestion.get(question.id);
    if (!snapshot || !result) return false;
    if (filter === "incorrect") return result.status === "incorrect";
    if (filter === "unanswered") return result.status === "unanswered";
    if (filter === "ungraded") return result.status === "ungraded";
    if (filter === "flagged") return snapshot.flaggedQuestions.includes(question.id);
    return true;
  });

  async function toggleMistake(questionId: string, result: QuestionResult) {
    if (!snapshot) return;
    const question = reviewQuestions.find((item) => item.id === questionId);
    if (!question) return;
    const id = `${test.id}:${sectionKey}:${question.id}`;
    if (mistakeIds.has(id)) {
      await mistakeRepository.removeMistake(id);
      setMistakeIds((current) => new Set([...current].filter((item) => item !== id)));
      return;
    }
    const mistake: MistakeItem = {
      id,
      testId: test.id,
      testTitle: test.title,
      section: sectionKey,
      questionId: question.id,
      questionNumber: question.number,
      userAnswer: snapshot.answers[question.id],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      lastWrongAt: new Date().toISOString(),
      attemptedAt: snapshot.submittedAt,
      status: result.status,
      notes: snapshot.notes[question.id]
    };
    await mistakeRepository.saveMistake(mistake);
    setMistakeIds((current) => new Set(current).add(id));
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <EmptyState title="No submitted attempt" body="Submit a practice section first, then return here to review the score." />
        <ReviewMaterials test={test} />
        <div className="mt-4 flex gap-2"><Button href={`/tests/${test.id}`}>Back to test</Button><Button href={`/practice/${test.id}/${sectionKey}`} variant="primary">Start practice</Button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs uppercase text-muted">{section.title}</p><h1 className="text-2xl font-semibold">Review</h1></div>
        <div className="flex gap-2"><Button href={`/practice/${test.id}/${sectionKey}`}>Practice again</Button><Button href="/tests">All tests</Button></div>
      </div>
      <div className="mt-4"><ReviewSummary score={snapshot.score} submittedAt={snapshot.submittedAt} durationSeconds={snapshot.durationSeconds} /></div>
      {(sectionKey === "writing" || sectionKey === "speaking") && structuredQuestions.length ? (
        <AiScoringPanel
          attemptId={`${test.id}:${sectionKey}`}
          questions={structuredQuestions}
          answers={snapshot.answers}
          section={sectionKey}
        />
      ) : null}
      <ReviewMaterials test={test} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ReviewFilters value={filter} onChange={setFilter} />
        <AnswerVisibilityToggle show={showCorrectAnswers} onChange={setShowCorrectAnswers} />
      </div>
      <div className="mt-4"><ReviewQuestionNav results={snapshot.score.questionResults} flaggedQuestions={snapshot.flaggedQuestions} activeId={activeQuestionId} onSelect={setActiveQuestionId} /></div>
      <div className="mt-4 grid gap-3">
        {questions.length === 0 ? <EmptyState title="No questions match this filter" body="Choose another filter to continue reviewing." /> : null}
        {questions.map((question) => {
          const result = resultByQuestion.get(question.id);
          if (!result) return null;
          const mistakeId = `${test.id}:${sectionKey}:${question.id}`;
          const reveal = answerOverrides[question.id] ?? showCorrectAnswers;
          return (
            <ReviewQuestion
              key={question.id}
              question={question}
              result={result}
              note={snapshot.notes[question.id]}
              flagged={snapshot.flaggedQuestions.includes(question.id)}
              reveal={reveal}
              onToggleReveal={() => setAnswerOverrides((current) => ({ ...current, [question.id]: !reveal }))}
              inMistakes={mistakeIds.has(mistakeId)}
              onToggleMistake={() => void toggleMistake(question.id, result)}
              vocabularySource={{
                testId: test.id,
                testTitle: test.title,
                section: sectionKey,
                questionId: question.id,
                questionNumber: question.number,
                attemptId: `${test.id}:${sectionKey}`,
                resultStatus: result.status,
                addedFrom: "review"
              }}
              sourceCandidates={[
                { label: "Question", text: question.prompt || "" },
                { label: "Your answer", text: Array.isArray(result.userAnswer) ? result.userAnswer.join(" ") : String(result.userAnswer || "") },
                { label: "Correct answer", text: Array.isArray(result.correctAnswer) ? result.correctAnswer.join(" ") : String(result.correctAnswer || "") },
                { label: "Explanation", text: question.explanation || "" }
              ].filter((candidate) => candidate.text.trim().length > 0)}
            />
          );
        })}
      </div>
    </div>
  );
}
