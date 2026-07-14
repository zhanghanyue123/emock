import type { QuestionResultStatus } from "@/types/practice";

export const RESULT_STATUS_STYLES: Record<QuestionResultStatus, {
  label: string;
  icon: string;
  card: string;
  badge: string;
  nav: string;
}> = {
  correct: {
    label: "Correct",
    icon: "OK",
    card: "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100",
    badge: "border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
    nav: "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200"
  },
  incorrect: {
    label: "Incorrect",
    icon: "X",
    card: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100",
    badge: "border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
    nav: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
  },
  unanswered: {
    label: "Unanswered",
    icon: "!",
    card: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
    badge: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    nav: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
  },
  ungraded: {
    label: "Ungraded",
    icon: "-",
    card: "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    nav: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
  }
};
