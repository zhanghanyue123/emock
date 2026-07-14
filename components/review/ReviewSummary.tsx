import { Card } from "@/components/ui/Card";
import { formatSeconds } from "@/lib/format";
import type { AttemptScore } from "@/types/practice";

export function ReviewSummary({ score, submittedAt, durationSeconds }: { score: AttemptScore; submittedAt?: string; durationSeconds: number }) {
  const hasUngraded = score.ungradedQuestions > 0;
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <div><p className="text-xs text-muted">Completed</p><p className="font-semibold">{submittedAt ? new Date(submittedAt).toLocaleString() : "Draft"}</p></div>
        <div><p className="text-xs text-muted">Correct</p><p className="font-semibold">{score.correctAnswers} / {score.objectiveQuestions}</p></div>
        <div><p className="text-xs text-muted">Accuracy</p><p className="font-semibold">{score.accuracy === null ? "N/A" : `${Math.round(score.accuracy * 100)}%`}</p></div>
        <div><p className="text-xs text-muted">Incorrect</p><p className="font-semibold">{score.incorrectAnswers}</p></div>
        <div><p className="text-xs text-muted">Unanswered</p><p className="font-semibold">{score.unansweredQuestions}</p></div>
        <div><p className="text-xs text-muted">Ungraded</p><p className="font-semibold">{score.ungradedQuestions}</p></div>
        <div><p className="text-xs text-muted">Answered</p><p className="font-semibold">{score.answeredQuestions}/{score.totalQuestions}</p></div>
        <div><p className="text-xs text-muted">Total time</p><p className="font-semibold">{formatSeconds(durationSeconds)}</p></div>
      </div>
      {hasUngraded ? <p className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">Writing and speaking responses are not included in the automatic score.</p> : null}
    </Card>
  );
}
