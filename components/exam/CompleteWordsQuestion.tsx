import type { TestQuestion } from "@/types/structured-test";

export function CompleteWordsQuestion({ question }: { question: TestQuestion }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3 text-sm text-muted dark:border-slate-700 dark:bg-slate-950">
      {question.instructions || "Complete the missing letters in the passage on the left."}
    </div>
  );
}
