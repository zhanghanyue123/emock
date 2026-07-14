"use client";

import { useEffect, useState } from "react";
import { getAiScoringForAttempt, queueAiScoringForAttempt } from "@/lib/ai-scoring/client-store";
import type { AiEvaluationRecord, AiScoringJob, SpeakingScoringResult, WritingScoringResult } from "@/types/ai-scoring";
import type { AnswerValue } from "@/types/test";
import type { TestQuestion } from "@/types/structured-test";

function isScoreResult(result: AiEvaluationRecord["result"]): result is WritingScoringResult | SpeakingScoringResult {
  return "overallScore" in result && "dimensions" in result;
}

function statusText(jobs: AiScoringJob[], evaluations: AiEvaluationRecord[]) {
  if (jobs.some((job) => job.status === "processing" || job.status === "queued")) return "Scoring";
  if (jobs.some((job) => job.status === "failed")) return evaluations.length ? "Partially scored" : "Scoring temporarily unavailable";
  return evaluations.length ? "Scored" : "No AI scoring jobs";
}

export function AiScoringPanel({ attemptId, questions, answers, section }: {
  attemptId: string;
  questions: TestQuestion[];
  answers: Record<string, AnswerValue>;
  section: "writing" | "speaking";
}) {
  const [version, setVersion] = useState(0);
  const data = getAiScoringForAttempt(attemptId);
  const scored = data.evaluations.filter((evaluation) => isScoreResult(evaluation.result));

  useEffect(() => {
    const timer = window.setInterval(() => setVersion((value) => value + 1), 1500);
    return () => window.clearInterval(timer);
  }, []);

  async function scoreNow() {
    await queueAiScoringForAttempt({ attemptId, questions, answers });
    setVersion(version + 1);
  }

  const sectionScore = scored.length
    ? scored.reduce((sum, evaluation) => sum + (isScoreResult(evaluation.result) ? evaluation.result.overallScore : 0), 0) / scored.length
    : null;

  return (
    <div className="mt-4 rounded-lg border border-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{section === "writing" ? "Writing" : "Speaking"} AI-estimated score</h2>
          <p className="mt-1 text-sm text-muted">This is a practice estimate and not an official TOEFL score.</p>
        </div>
        <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel dark:border-slate-700" onClick={() => void scoreNow()}>
          Retry scoring
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-panel p-3 dark:bg-slate-950">
          <p className="text-xs uppercase text-muted">Status</p>
          <p className="mt-1 font-semibold">{statusText(data.jobs, data.evaluations)}</p>
        </div>
        <div className="rounded-md bg-panel p-3 dark:bg-slate-950">
          <p className="text-xs uppercase text-muted">Tasks scored</p>
          <p className="mt-1 font-semibold">{scored.length} / {questions.filter((question) => question.type === "write_email" || question.type === "academic_discussion" || question.type === "listen_repeat" || question.type === "interview_response").length}</p>
        </div>
        <div className="rounded-md bg-panel p-3 dark:bg-slate-950">
          <p className="text-xs uppercase text-muted">Partial estimate</p>
          <p className="mt-1 font-semibold">{sectionScore === null ? "Scoring" : `${sectionScore.toFixed(1)} / 5`}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {scored.map((evaluation) => {
          const result = evaluation.result;
          if (!isScoreResult(result)) return null;
          return (
            <details key={evaluation.id} className="rounded-md border border-line p-3 dark:border-slate-700">
              <summary className="cursor-pointer font-medium">
                {evaluation.questionId}: {result.overallScore} / {result.maxScore} {result.needsHumanReview ? " · needs review" : ""}
              </summary>
              {"transcript" in result && result.transcript ? <p className="mt-3 text-sm"><span className="text-muted">Transcript:</span> {result.transcript}</p> : null}
              <p className="mt-3 text-sm">{"conciseFeedback" in result ? result.conciseFeedback : "Practice estimate completed."}</p>
              <div className="mt-3 grid gap-2">
                {result.dimensions.map((dimension) => (
                  <div key={dimension.id} className="rounded bg-panel p-2 text-sm dark:bg-slate-950">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{dimension.id}</span>
                      <span>{dimension.score} / {dimension.maxScore}</span>
                    </div>
                    <p className="mt-1 text-muted">{dimension.feedback}</p>
                  </div>
                ))}
              </div>
              {result.strengths.length ? <p className="mt-3 text-sm"><span className="font-medium">Strengths:</span> {result.strengths.join(" ")}</p> : null}
              {result.improvements.length ? <p className="mt-2 text-sm"><span className="font-medium">Improve next:</span> {result.improvements.join(" ")}</p> : null}
              <p className="mt-2 text-xs text-muted">Provider: {evaluation.provider} · Model: {evaluation.model} · Rubric: {evaluation.rubricVersion}</p>
            </details>
          );
        })}
      </div>
    </div>
  );
}
