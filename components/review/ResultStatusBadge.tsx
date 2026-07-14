import { RESULT_STATUS_STYLES } from "@/lib/result-styles";
import type { QuestionResultStatus } from "@/types/practice";

export function ResultStatusBadge({ status }: { status: QuestionResultStatus }) {
  const style = RESULT_STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${style.badge}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
