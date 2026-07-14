import type { VocabularyStatus } from "@/types/practice";

const labels: Record<VocabularyStatus, string> = {
  new: "New",
  learning: "Learning",
  mastered: "Mastered",
  archived: "Archived"
};

const styles: Record<VocabularyStatus, string> = {
  new: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
  learning: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  mastered: "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
  archived: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
};

export function VocabularyStatusBadge({ status }: { status: VocabularyStatus }) {
  return <span className={`rounded-full border px-2 py-1 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}
